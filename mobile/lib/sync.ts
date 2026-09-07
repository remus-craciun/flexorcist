import { apiRequest } from "./http";
import type { Exercise, ProgramDetail, Session, Workout, WorkoutExercise } from "./api";
import { getDb } from "./db";
import {
  type ExerciseRow,
  type ProgramRow,
  type SessionRow,
  type WorkoutExerciseRow,
  type WorkoutRow,
  clearDirty,
  getByServerId,
  getExerciseRow,
  getProgramRow,
  getWorkoutRow,
  pendingCreates,
  pendingDeletes,
  pendingUpdates,
  pruneMissingServerRows,
  removeLocalRow,
  setServerId,
  upsertExerciseFromServer,
  upsertProgramFromServer,
  upsertSessionFromServer,
  upsertWorkoutExerciseFromServer,
  upsertWorkoutFromServer,
} from "./local";
import { isOnline } from "./network";

type Snapshot = {
  exercises: Exercise[];
  programs: ProgramDetail[];
  sessions?: Session[];
};

let inFlight: Promise<void> | null = null;
let settled = false;

async function ignoreMissing(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (err) {
    const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
    if (status !== 404) throw err;
  }
}

export async function pullSnapshot() {
  const data = await apiRequest<Snapshot>("/sync");
  const exerciseIds: number[] = [];
  const programIds: number[] = [];
  const workoutIds: number[] = [];
  const itemIds: number[] = [];

  const sessionIds: number[] = [];

  for (const exercise of data.exercises) {
    await upsertExerciseFromServer(exercise);
    exerciseIds.push(exercise.id);
  }

  for (const program of data.programs) {
    const localProgramId = await upsertProgramFromServer(program);
    programIds.push(program.id);
    for (const workout of program.workouts) {
      const localWorkoutId = await upsertWorkoutFromServer(localProgramId, workout);
      workoutIds.push(workout.id);
      for (const item of workout.exercises) {
        const localExerciseId = await upsertExerciseFromServer(item.exercise);
        exerciseIds.push(item.exercise.id);
        await upsertWorkoutExerciseFromServer(localWorkoutId, localExerciseId, item);
        itemIds.push(item.id);
      }
    }
  }

  for (const session of data.sessions ?? []) {
    const localWorkout = session.workoutId
      ? await getByServerId<WorkoutRow>("workouts", session.workoutId)
      : null;
    const localProgram = session.programId
      ? await getByServerId<ProgramRow>("programs", session.programId)
      : null;
    await upsertSessionFromServer(session, localWorkout?.id ?? null, localProgram?.id ?? null);
    sessionIds.push(session.id);
  }

  if (data.sessions) {
    await pruneMissingServerRows("sessions", [...new Set(sessionIds)]);
  }
  await pruneMissingServerRows("workout_exercises", [...new Set(itemIds)]);
  await pruneMissingServerRows("workouts", [...new Set(workoutIds)]);
  await pruneMissingServerRows("programs", [...new Set(programIds)]);
  await pruneMissingServerRows("exercises", [...new Set(exerciseIds)]);
}

export async function pushPending() {
  for (const row of (await pendingDeletes("programs")) as ProgramRow[]) {
    if (row.server_id) {
      await ignoreMissing(() => apiRequest(`/programs/${row.server_id}`, { method: "DELETE" }));
    }
    const db = await getDb();
    await db.runAsync(
      "DELETE FROM workout_exercises WHERE workout_id IN (SELECT id FROM workouts WHERE program_id = ?)",
      [row.id],
    );
    await db.runAsync("DELETE FROM workouts WHERE program_id = ?", [row.id]);
    await removeLocalRow("programs", row.id);
  }

  for (const row of (await pendingDeletes("workout_exercises")) as WorkoutExerciseRow[]) {
    const workout = await getWorkoutRow(row.workout_id);
    const program = workout ? await getProgramRow(workout.program_id) : null;
    if (program?.server_id && workout?.server_id && row.server_id) {
      await ignoreMissing(() =>
        apiRequest(
          `/programs/${program.server_id}/workouts/${workout.server_id}/exercises/${row.server_id}`,
          { method: "DELETE" },
        ),
      );
    }
    await removeLocalRow("workout_exercises", row.id);
  }

  for (const row of (await pendingDeletes("workouts")) as WorkoutRow[]) {
    const program = await getProgramRow(row.program_id);
    if (program?.server_id && row.server_id) {
      await ignoreMissing(() =>
        apiRequest(`/programs/${program.server_id}/workouts/${row.server_id}`, { method: "DELETE" }),
      );
    }
    await removeLocalRow("workouts", row.id);
  }

  for (const row of (await pendingDeletes("exercises")) as ExerciseRow[]) {
    if (row.server_id) {
      await ignoreMissing(() => apiRequest(`/exercises/${row.server_id}`, { method: "DELETE" }));
    }
    await removeLocalRow("exercises", row.id);
  }

  for (const row of (await pendingCreates("exercises")) as ExerciseRow[]) {
    const { exercise } = await apiRequest<{ exercise: Exercise }>("/exercises", {
      body: {
        name: row.name,
        muscles: JSON.parse(row.muscles),
        equipment: JSON.parse(row.equipment),
        description: row.description,
        source: row.source,
      },
    });
    await setServerId("exercises", row.id, exercise.id);
  }

  for (const row of (await pendingCreates("programs")) as ProgramRow[]) {
    const { program } = await apiRequest<{ program: { id: number } }>("/programs", {
      body: {
        title: row.title,
        weeks: row.weeks,
        notes: row.notes,
        status: row.status,
      },
    });
    await setServerId("programs", row.id, program.id);
  }

  for (const row of (await pendingCreates("workouts")) as WorkoutRow[]) {
    const program = await getProgramRow(row.program_id);
    if (!program?.server_id) continue;
    const { workout } = await apiRequest<{ workout: Workout }>(
      `/programs/${program.server_id}/workouts`,
      {
        body: {
          week: row.week,
          dayIndex: row.day_index,
          label: row.label,
          location: row.location,
        },
      },
    );
    await setServerId("workouts", row.id, workout.id);
  }

  for (const row of (await pendingCreates("workout_exercises")) as WorkoutExerciseRow[]) {
    const workout = await getWorkoutRow(row.workout_id);
    const program = workout ? await getProgramRow(workout.program_id) : null;
    const exercise = await getExerciseRow(row.exercise_id);
    if (!program?.server_id || !workout?.server_id || !exercise?.server_id) continue;
    const { workoutExercise } = await apiRequest<{ workoutExercise: WorkoutExercise }>(
      `/programs/${program.server_id}/workouts/${workout.server_id}/exercises`,
      {
        body: {
          exerciseId: exercise.server_id,
          sortOrder: row.sort_order,
          sets: row.sets,
          reps: row.reps,
          restSeconds: row.rest_seconds,
          notes: row.notes,
        },
      },
    );
    await setServerId("workout_exercises", row.id, workoutExercise.id);
  }

  for (const row of (await pendingCreates("sessions")) as SessionRow[]) {
    const workout = row.workout_id ? await getWorkoutRow(row.workout_id) : null;
    const program = row.program_id ? await getProgramRow(row.program_id) : null;
    if (row.workout_id && !workout?.server_id) continue;
    const { session } = await apiRequest<{ session: Session }>("/sessions", {
      body: {
        workoutId: workout?.server_id ?? null,
        programId: program?.server_id ?? null,
        week: row.week,
        dayIndex: row.day_index,
        location: row.location,
        label: row.label,
        programTitle: row.program_title,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        durationMs: row.duration_ms,
      },
    });
    await setServerId("sessions", row.id, session.id);
  }

  for (const row of (await pendingUpdates("exercises")) as ExerciseRow[]) {
    await apiRequest(`/exercises/${row.server_id}`, {
      method: "PATCH",
      body: {
        name: row.name,
        muscles: JSON.parse(row.muscles),
        equipment: JSON.parse(row.equipment),
        description: row.description,
        source: row.source,
      },
    });
    await clearDirty("exercises", row.id);
  }

  for (const row of (await pendingUpdates("programs")) as ProgramRow[]) {
    await apiRequest(`/programs/${row.server_id}`, {
      method: "PATCH",
      body: {
        title: row.title,
        weeks: row.weeks,
        notes: row.notes,
        status: row.status,
      },
    });
    await clearDirty("programs", row.id);
  }

  for (const row of (await pendingUpdates("workouts")) as WorkoutRow[]) {
    const program = await getProgramRow(row.program_id);
    if (!program?.server_id || !row.server_id) continue;
    await apiRequest(`/programs/${program.server_id}/workouts/${row.server_id}`, {
      method: "PATCH",
      body: {
        week: row.week,
        dayIndex: row.day_index,
        label: row.label,
        location: row.location,
      },
    });
    await clearDirty("workouts", row.id);
  }

  for (const row of (await pendingUpdates("workout_exercises")) as WorkoutExerciseRow[]) {
    const workout = await getWorkoutRow(row.workout_id);
    const program = workout ? await getProgramRow(workout.program_id) : null;
    const exercise = await getExerciseRow(row.exercise_id);
    if (!program?.server_id || !workout?.server_id || !exercise?.server_id || !row.server_id) continue;
    await apiRequest(
      `/programs/${program.server_id}/workouts/${workout.server_id}/exercises/${row.server_id}`,
      {
        method: "PATCH",
        body: {
          exerciseId: exercise.server_id,
          sortOrder: row.sort_order,
          sets: row.sets,
          reps: row.reps,
          restSeconds: row.rest_seconds,
          notes: row.notes,
        },
      },
    );
    await clearDirty("workout_exercises", row.id);
  }
}

export async function syncNow() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    if (!(await isOnline())) return;
    await pushPending();
    await pullSnapshot();
    settled = true;
  })()
    .catch((err) => {
      console.warn("sync failed", err instanceof Error ? err.message : err);
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export async function refreshLocal() {
  await syncNow();
}

export async function ensureHydrated() {
  if (settled) return;
  await syncNow();
}

/** Local SQLite first. Wait for the first successful sync only when this device has no cached row yet. */
export async function readThroughCache<T>(
  read: () => Promise<T>,
  hasCache: (value: T) => boolean,
): Promise<T> {
  const local = await read();
  if (hasCache(local) || settled) return local;
  await syncNow();
  return read();
}
