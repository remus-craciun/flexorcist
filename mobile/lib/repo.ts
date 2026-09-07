import { ApiError, apiRequest } from "./http";
import type {
  Exercise,
  ProgramDetail,
  ProgramInput,
  SessionInput,
  TrainingDayInput,
  Workout,
  WorkoutExercise,
  WorkoutExerciseInput,
  WorkoutInput,
} from "./api";
import {
  addWorkoutExerciseLocal,
  countExerciseUsesLocal,
  deleteExerciseLocal,
  deleteProgramLocal,
  deleteWorkoutLocal,
  getExerciseLocal,
  getProgramByServerId,
  getProgramLocal,
  getWorkoutLocal,
  insertExerciseLocal,
  insertProgramLocal,
  insertSessionLocal,
  insertTrainingDayLocal,
  insertWorkoutLocal,
  listExercisesLocal,
  listProgramsLocal,
  listSessionsLocal,
  removeWorkoutExerciseLocal,
  updateExerciseLocal,
  updateProgramLocal,
  updateWorkoutExerciseLocal,
  updateWorkoutLocal,
} from "./local";
import { isOnline } from "./network";
import { readThroughCache, refreshLocal, syncNow, ensureHydrated } from "./sync";

async function afterWrite<T>(value: T): Promise<T> {
  void syncNow();
  return value;
}

export async function listExercises(options?: { refresh?: boolean }) {
  if (options?.refresh) await syncNow();
  const exercises = options?.refresh
    ? await listExercisesLocal()
    : await readThroughCache(listExercisesLocal, (rows) => rows.length > 0);
  return { exercises };
}

export async function createExercise(input: {
  name: string;
  muscles?: string[];
  equipment?: string[];
  description?: string;
  source?: "ai" | "user";
}) {
  const exercise = await insertExerciseLocal(input);
  return afterWrite({ exercise });
}

export async function getExercise(id: number) {
  const exercise = await readThroughCache(
    () => getExerciseLocal(id),
    (row) => row != null,
  );
  if (!exercise) throw new ApiError("Exercise not found", 404, null);
  return { exercise };
}

export async function updateExercise(
  id: number,
  input: { name?: string; muscles?: string[]; description?: string },
) {
  const exercise = await updateExerciseLocal(id, input);
  if (!exercise) throw new ApiError("Exercise not found", 404, null);
  return afterWrite({ exercise });
}

export async function deleteExercise(id: number) {
  const ok = await deleteExerciseLocal(id);
  if (!ok) throw new ApiError("Exercise not found", 404, null);
  return afterWrite({ ok: true });
}

export async function countExerciseUses(id: number) {
  return countExerciseUsesLocal(id);
}

export async function listPrograms(options?: { refresh?: boolean }) {
  if (options?.refresh) await syncNow();
  const programs = options?.refresh
    ? await listProgramsLocal()
    : await readThroughCache(listProgramsLocal, (rows) => rows.length > 0);
  return { programs };
}

export async function getProgram(id: number) {
  const program = await readThroughCache(
    () => getProgramLocal(id),
    (row) => row != null,
  );
  if (!program) throw new ApiError("Program not found", 404, null);
  return { program };
}

export async function createProgram(input: ProgramInput) {
  const program = await insertProgramLocal(input);
  return afterWrite({ program });
}

export async function updateProgram(id: number, input: Partial<ProgramInput>) {
  const program = await updateProgramLocal(id, input);
  if (!program) throw new ApiError("Program not found", 404, null);
  return afterWrite({ program: program as ProgramDetail });
}

export async function followProgram(id: number) {
  return updateProgram(id, { status: "active" });
}

export async function deleteProgram(id: number) {
  const ok = await deleteProgramLocal(id);
  if (!ok) throw new ApiError("Program not found", 404, null);
  return afterWrite({ ok: true });
}

export async function generateProgram(
  input: { weeks?: number; volume?: "low" | "medium" | "high" | "extra_high"; focus?: string } = {},
) {
  if (!(await isOnline())) {
    throw new ApiError("Generating a program needs a connection", 0, null);
  }
  const result = await apiRequest<{ program: ProgramDetail; createdExerciseCount: number }>(
    "/programs/generate",
    { body: input },
  );
  await refreshLocal();
  const program = await getProgramByServerId(result.program.id);
  if (!program) {
    throw new ApiError("Generated program could not be saved locally", 500, null);
  }
  return { program, createdExerciseCount: result.createdExerciseCount };
}

export async function createTrainingDay(programId: number, input: TrainingDayInput) {
  try {
    const workouts = await insertTrainingDayLocal(programId, input);
    return afterWrite({ workouts });
  } catch (err) {
    throw new ApiError(err instanceof Error ? err.message : "Failed to add training day", 400, null);
  }
}

export async function createWorkout(programId: number, input: WorkoutInput) {
  const workout = await insertWorkoutLocal(programId, input);
  return afterWrite({ workout });
}

export async function getWorkout(programId: number, workoutId: number) {
  const workout = await readThroughCache(
    () => getWorkoutLocal(programId, workoutId),
    (row) => row != null,
  );
  if (!workout) throw new ApiError("Workout not found", 404, null);
  return { workout };
}

export async function updateWorkout(
  programId: number,
  workoutId: number,
  input: Partial<WorkoutInput>,
) {
  const workout = await updateWorkoutLocal(programId, workoutId, input);
  if (!workout) throw new ApiError("Workout not found", 404, null);
  return afterWrite({ workout });
}

export async function deleteWorkout(programId: number, workoutId: number) {
  const ok = await deleteWorkoutLocal(programId, workoutId);
  if (!ok) throw new ApiError("Workout not found", 404, null);
  return afterWrite({ ok: true });
}

export async function addWorkoutExercise(
  programId: number,
  workoutId: number,
  input: WorkoutExerciseInput,
) {
  const workoutExercise = await addWorkoutExerciseLocal(programId, workoutId, input);
  return afterWrite({ workoutExercise });
}

export async function updateWorkoutExercise(
  programId: number,
  workoutId: number,
  itemId: number,
  input: Partial<WorkoutExerciseInput>,
) {
  const workoutExercise = await updateWorkoutExerciseLocal(programId, workoutId, itemId, input);
  return afterWrite({ workoutExercise });
}

export async function removeWorkoutExercise(
  programId: number,
  workoutId: number,
  itemId: number,
) {
  const ok = await removeWorkoutExerciseLocal(programId, workoutId, itemId);
  if (!ok) throw new ApiError("Workout exercise not found", 404, null);
  return afterWrite({ ok: true });
}

export async function listSessions() {
  await ensureHydrated();
  return { sessions: await listSessionsLocal() };
}

export async function createSession(input: SessionInput) {
  try {
    const session = await insertSessionLocal(input);
    return afterWrite({ session });
  } catch (err) {
    throw new ApiError(err instanceof Error ? err.message : "Failed to save session", 400, null);
  }
}