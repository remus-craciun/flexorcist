import { getDb } from "./db";
import type {
  Exercise,
  Program,
  ProgramDetail,
  ProgramInput,
  ProgramStatus,
  Session,
  Workout,
  WorkoutExercise,
  WorkoutExerciseInput,
  WorkoutInput,
} from "./api";

export type ExerciseRow = {
  id: number;
  server_id: number | null;
  name: string;
  muscles: string;
  equipment: string;
  description: string;
  source: "ai" | "user";
  created_at: string;
  dirty: number;
  deleted: number;
};

export type ProgramRow = {
  id: number;
  server_id: number | null;
  title: string;
  weeks: number;
  notes: string;
  status: ProgramStatus;
  created_at: string;
  dirty: number;
  deleted: number;
};

export type WorkoutRow = {
  id: number;
  server_id: number | null;
  program_id: number;
  week: number;
  day_index: number;
  label: string | null;
  location: "home" | "park" | "gym";
  dirty: number;
  deleted: number;
};

export type WorkoutExerciseRow = {
  id: number;
  server_id: number | null;
  workout_id: number;
  exercise_id: number;
  sort_order: number;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string;
  dirty: number;
  deleted: number;
};

export type SessionRow = {
  id: number;
  server_id: number | null;
  workout_id: number | null;
  program_id: number | null;
  week: number;
  day_index: number;
  location: "home" | "park" | "gym";
  label: string | null;
  program_title: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  dirty: number;
  deleted: number;
};

export type SyncTable = "exercises" | "programs" | "workouts" | "workout_exercises" | "sessions";

function now() {
  return new Date().toISOString();
}

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function mapExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    muscles: parseList(row.muscles),
    equipment: parseList(row.equipment),
    description: row.description,
    source: row.source,
    createdAt: row.created_at,
  };
}

function mapProgram(row: ProgramRow): Program {
  return {
    id: row.id,
    title: row.title,
    weeks: row.weeks,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapWorkoutExercise(row: WorkoutExerciseRow, exercise: Exercise): WorkoutExercise {
  return {
    id: row.id,
    workoutId: row.workout_id,
    exerciseId: row.exercise_id,
    sortOrder: row.sort_order,
    sets: row.sets,
    reps: row.reps,
    restSeconds: row.rest_seconds,
    notes: row.notes,
    exercise,
  };
}

function mapWorkout(row: WorkoutRow, items: WorkoutExercise[]): Workout {
  return {
    id: row.id,
    programId: row.program_id,
    week: row.week,
    dayIndex: row.day_index,
    label: row.label,
    location: row.location,
    exercises: items,
  };
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    workoutId: row.workout_id,
    programId: row.program_id,
    week: row.week,
    dayIndex: row.day_index,
    location: row.location,
    label: row.label,
    programTitle: row.program_title,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
  };
}

export async function listExerciseRows() {
  const db = await getDb();
  return db.getAllAsync<ExerciseRow>(
    "SELECT * FROM exercises WHERE deleted = 0 ORDER BY name COLLATE NOCASE",
  );
}

export async function listExercisesLocal() {
  return (await listExerciseRows()).map(mapExercise);
}

export async function insertExerciseLocal(input: {
  name: string;
  muscles?: string[];
  equipment?: string[];
  description?: string;
  source?: "ai" | "user";
}): Promise<Exercise> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO exercises (name, muscles, equipment, description, source, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [
      input.name,
      JSON.stringify(input.muscles ?? []),
      JSON.stringify(input.equipment ?? []),
      input.description ?? "",
      input.source ?? "user",
      now(),
    ],
  );
  const row = await db.getFirstAsync<ExerciseRow>("SELECT * FROM exercises WHERE id = ?", [
    result.lastInsertRowId,
  ]);
  return mapExercise(row!);
}

export async function getExerciseLocal(id: number): Promise<Exercise | null> {
  const row = await getExerciseRow(id);
  if (!row || row.deleted) return null;
  return mapExercise(row);
}

export async function updateExerciseLocal(
  id: number,
  input: { name?: string; muscles?: string[]; description?: string },
): Promise<Exercise | null> {
  const existing = await getExerciseRow(id);
  if (!existing || existing.deleted) return null;
  const db = await getDb();
  const dirty = existing.server_id != null ? 1 : 0;
  await db.runAsync(
    `UPDATE exercises SET name = ?, muscles = ?, description = ?, dirty = ? WHERE id = ?`,
    [
      input.name ?? existing.name,
      JSON.stringify(input.muscles ?? parseList(existing.muscles)),
      input.description ?? existing.description,
      dirty,
      id,
    ],
  );
  return getExerciseLocal(id);
}

export async function countExerciseUsesLocal(id: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM workout_exercises WHERE exercise_id = ? AND deleted = 0`,
    [id],
  );
  return row?.count ?? 0;
}

export async function deleteExerciseLocal(id: number): Promise<boolean> {
  const existing = await getExerciseRow(id);
  if (!existing || existing.deleted) return false;
  const db = await getDb();
  const items = await db.getAllAsync<WorkoutExerciseRow>(
    "SELECT * FROM workout_exercises WHERE exercise_id = ?",
    [id],
  );
  for (const item of items) {
    if (item.server_id == null) {
      await db.runAsync("DELETE FROM workout_exercises WHERE id = ?", [item.id]);
    } else {
      await db.runAsync("UPDATE workout_exercises SET deleted = 1, dirty = 1 WHERE id = ?", [
        item.id,
      ]);
    }
  }
  if (existing.server_id == null) {
    await db.runAsync("DELETE FROM exercises WHERE id = ?", [id]);
  } else {
    await db.runAsync("UPDATE exercises SET deleted = 1, dirty = 1 WHERE id = ?", [id]);
  }
  return true;
}

export async function listProgramRows() {
  const db = await getDb();
  return db.getAllAsync<ProgramRow>(
    "SELECT * FROM programs WHERE deleted = 0 ORDER BY id",
  );
}

export async function listProgramsLocal() {
  return (await listProgramRows()).map(mapProgram);
}

export async function getProgramRow(id: number) {
  const db = await getDb();
  return db.getFirstAsync<ProgramRow>("SELECT * FROM programs WHERE id = ?", [id]);
}

type JoinedWorkoutExercise = WorkoutExerciseRow &
  Pick<ExerciseRow, "name" | "muscles" | "equipment" | "description" | "source" | "created_at">;

const WORKOUT_ITEM_SELECT = `SELECT we.id, we.server_id, we.workout_id, we.exercise_id, we.sort_order, we.sets, we.reps,
            we.rest_seconds, we.notes, we.dirty, we.deleted,
            e.name, e.muscles, e.equipment, e.description, e.source, e.created_at
     FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id`;

function mapJoinedWorkoutExercise(row: JoinedWorkoutExercise): WorkoutExercise {
  return mapWorkoutExercise(row, {
    id: row.exercise_id,
    name: row.name,
    muscles: parseList(row.muscles),
    equipment: parseList(row.equipment),
    description: row.description,
    source: row.source,
    createdAt: row.created_at,
  });
}

async function workoutItems(workoutId: number): Promise<WorkoutExercise[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<JoinedWorkoutExercise>(
    `${WORKOUT_ITEM_SELECT}
     WHERE we.workout_id = ? AND we.deleted = 0 AND e.deleted = 0
     ORDER BY we.sort_order, we.id`,
    [workoutId],
  );
  return rows.map(mapJoinedWorkoutExercise);
}

export async function getWorkoutLocal(programId: number, workoutId: number) {
  const db = await getDb();
  const row = await db.getFirstAsync<WorkoutRow>(
    "SELECT * FROM workouts WHERE id = ? AND program_id = ? AND deleted = 0",
    [workoutId, programId],
  );
  if (!row) return null;
  return mapWorkout(row, await workoutItems(row.id));
}

export async function getProgramLocal(id: number): Promise<ProgramDetail | null> {
  const program = await getProgramRow(id);
  if (!program || program.deleted) return null;
  const db = await getDb();
  const workouts = await db.getAllAsync<WorkoutRow>(
    `SELECT * FROM workouts WHERE program_id = ? AND deleted = 0
     ORDER BY week, day_index, location`,
    [id],
  );
  if (workouts.length === 0) {
    return { ...mapProgram(program), workouts: [] };
  }

  const items = await db.getAllAsync<JoinedWorkoutExercise>(
    `${WORKOUT_ITEM_SELECT}
     WHERE we.workout_id IN (${workouts.map(() => "?").join(",")})
       AND we.deleted = 0 AND e.deleted = 0
     ORDER BY we.workout_id, we.sort_order, we.id`,
    workouts.map((workout) => workout.id),
  );
  const byWorkout = new Map<number, WorkoutExercise[]>();
  for (const row of items) {
    const list = byWorkout.get(row.workout_id) ?? [];
    list.push(mapJoinedWorkoutExercise(row));
    byWorkout.set(row.workout_id, list);
  }

  return {
    ...mapProgram(program),
    workouts: workouts.map((workout) => mapWorkout(workout, byWorkout.get(workout.id) ?? [])),
  };
}

export async function listSessionsLocal(): Promise<Session[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SessionRow>(
    `SELECT * FROM sessions WHERE deleted = 0 ORDER BY ended_at DESC, id DESC`,
  );
  return rows.map(mapSession);
}

export async function insertSessionLocal(input: {
  workoutId: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}): Promise<Session> {
  const workout = await getWorkoutRow(input.workoutId);
  if (!workout || workout.deleted) {
    throw new Error("Workout not found");
  }
  const program = await getProgramRow(workout.program_id);
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO sessions (
       workout_id, program_id, week, day_index, location, label, program_title,
       started_at, ended_at, duration_ms, dirty
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      workout.id,
      workout.program_id,
      workout.week,
      workout.day_index,
      workout.location,
      workout.label,
      program?.title ?? "",
      input.startedAt,
      input.endedAt,
      input.durationMs,
    ],
  );
  const row = await db.getFirstAsync<SessionRow>("SELECT * FROM sessions WHERE id = ?", [
    result.lastInsertRowId,
  ]);
  return mapSession(row!);
}

async function demoteOtherActivePrograms(exceptId: number) {
  const db = await getDb();
  const others = await db.getAllAsync<ProgramRow>(
    `SELECT * FROM programs WHERE deleted = 0 AND id != ? AND status = 'active'`,
    [exceptId],
  );
  for (const row of others) {
    const dirty = row.server_id != null ? 1 : 0;
    await db.runAsync(`UPDATE programs SET status = 'draft', dirty = ? WHERE id = ?`, [
      dirty,
      row.id,
    ]);
  }
}

export async function insertProgramLocal(input: ProgramInput): Promise<Program> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO programs (title, weeks, notes, status, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [input.title, input.weeks, input.notes, input.status, now()],
  );
  if (input.status === "active") {
    await demoteOtherActivePrograms(result.lastInsertRowId);
  }
  const row = await db.getFirstAsync<ProgramRow>("SELECT * FROM programs WHERE id = ?", [
    result.lastInsertRowId,
  ]);
  return mapProgram(row!);
}

export async function updateProgramLocal(id: number, input: Partial<ProgramInput>) {
  const existing = await getProgramRow(id);
  if (!existing) return null;
  const db = await getDb();
  const next = {
    title: input.title ?? existing.title,
    weeks: input.weeks ?? existing.weeks,
    notes: input.notes ?? existing.notes,
    status: input.status ?? existing.status,
  };
  const dirty = existing.server_id != null ? 1 : 0;
  await db.runAsync(
    `UPDATE programs SET title = ?, weeks = ?, notes = ?, status = ?, dirty = ? WHERE id = ?`,
    [next.title, next.weeks, next.notes, next.status, dirty, id],
  );
  if (next.status === "active") {
    await demoteOtherActivePrograms(id);
  }
  return getProgramLocal(id);
}

export async function deleteProgramLocal(id: number) {
  const db = await getDb();
  const program = await db.getFirstAsync<ProgramRow>("SELECT * FROM programs WHERE id = ?", [id]);
  if (!program) return false;
  const workouts = await db.getAllAsync<WorkoutRow>(
    "SELECT * FROM workouts WHERE program_id = ?",
    [id],
  );
  for (const workout of workouts) {
    await db.runAsync("UPDATE workout_exercises SET deleted = 1, dirty = 1 WHERE workout_id = ?", [
      workout.id,
    ]);
    await db.runAsync("UPDATE workouts SET deleted = 1, dirty = 1 WHERE id = ?", [workout.id]);
  }
  if (program.server_id == null) {
    await db.runAsync(
      "DELETE FROM workout_exercises WHERE workout_id IN (SELECT id FROM workouts WHERE program_id = ?)",
      [id],
    );
    await db.runAsync("DELETE FROM workouts WHERE program_id = ?", [id]);
    await db.runAsync("DELETE FROM programs WHERE id = ?", [id]);
  } else {
    await db.runAsync("UPDATE programs SET deleted = 1, dirty = 1 WHERE id = ?", [id]);
  }
  return true;
}

export async function insertTrainingDayLocal(
  programId: number,
  input: { week: number; dayIndex: number; label?: string | null },
) {
  const program = await getProgramRow(programId);
  if (!program) throw new Error("Program not found");
  if (input.week > program.weeks) {
    throw new Error(`Week must be between 1 and ${program.weeks}`);
  }
  const db = await getDb();
  const existing = await db.getAllAsync<WorkoutRow>(
    `SELECT * FROM workouts WHERE program_id = ? AND week = ? AND day_index = ? AND deleted = 0`,
    [programId, input.week, input.dayIndex],
  );
  if (existing.length > 0) {
    throw new Error("Workouts already exist for this week and day");
  }

  const locations = ["home", "park", "gym"] as const;
  const workouts: Workout[] = [];
  for (const location of locations) {
    const result = await db.runAsync(
      `INSERT INTO workouts (program_id, week, day_index, label, location, dirty)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [programId, input.week, input.dayIndex, input.label ?? null, location],
    );
    const row = await db.getFirstAsync<WorkoutRow>("SELECT * FROM workouts WHERE id = ?", [
      result.lastInsertRowId,
    ]);
    workouts.push(mapWorkout(row!, []));
  }
  return workouts;
}

export async function insertWorkoutLocal(programId: number, input: WorkoutInput) {
  const program = await getProgramRow(programId);
  if (!program) throw new Error("Program not found");
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO workouts (program_id, week, day_index, label, location, dirty)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [programId, input.week, input.dayIndex, input.label ?? null, input.location],
  );
  const row = await db.getFirstAsync<WorkoutRow>("SELECT * FROM workouts WHERE id = ?", [
    result.lastInsertRowId,
  ]);
  return mapWorkout(row!, []);
}

export async function updateWorkoutLocal(
  programId: number,
  workoutId: number,
  input: Partial<WorkoutInput>,
) {
  const db = await getDb();
  const existing = await db.getFirstAsync<WorkoutRow>(
    "SELECT * FROM workouts WHERE id = ? AND program_id = ? AND deleted = 0",
    [workoutId, programId],
  );
  if (!existing) return null;
  const dirty = existing.server_id != null ? 1 : 0;
  await db.runAsync(
    `UPDATE workouts SET week = ?, day_index = ?, label = ?, location = ?, dirty = ? WHERE id = ?`,
    [
      input.week ?? existing.week,
      input.dayIndex ?? existing.day_index,
      input.label === undefined ? existing.label : input.label,
      input.location ?? existing.location,
      dirty,
      workoutId,
    ],
  );
  return getWorkoutLocal(programId, workoutId);
}

export async function deleteWorkoutLocal(programId: number, workoutId: number) {
  const db = await getDb();
  const workout = await db.getFirstAsync<WorkoutRow>(
    "SELECT * FROM workouts WHERE id = ? AND program_id = ?",
    [workoutId, programId],
  );
  if (!workout) return false;
  if (workout.server_id == null) {
    await db.runAsync("DELETE FROM workout_exercises WHERE workout_id = ?", [workoutId]);
    await db.runAsync("DELETE FROM workouts WHERE id = ?", [workoutId]);
  } else {
    await db.runAsync("UPDATE workout_exercises SET deleted = 1, dirty = 1 WHERE workout_id = ?", [
      workoutId,
    ]);
    await db.runAsync("UPDATE workouts SET deleted = 1, dirty = 1 WHERE id = ?", [workoutId]);
  }
  return true;
}

export async function addWorkoutExerciseLocal(
  programId: number,
  workoutId: number,
  input: WorkoutExerciseInput,
) {
  const workout = await getWorkoutLocal(programId, workoutId);
  if (!workout) throw new Error("Workout not found");
  const db = await getDb();
  const exercise = await db.getFirstAsync<ExerciseRow>(
    "SELECT * FROM exercises WHERE id = ? AND deleted = 0",
    [input.exerciseId],
  );
  if (!exercise) throw new Error("Exercise not found");
  const result = await db.runAsync(
    `INSERT INTO workout_exercises (workout_id, exercise_id, sort_order, sets, reps, rest_seconds, notes, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      workoutId,
      input.exerciseId,
      input.sortOrder ?? 0,
      input.sets ?? 3,
      input.reps ?? "8-12",
      input.restSeconds ?? 90,
      input.notes ?? "",
    ],
  );
  const row = await db.getFirstAsync<WorkoutExerciseRow>(
    "SELECT * FROM workout_exercises WHERE id = ?",
    [result.lastInsertRowId],
  );
  return mapWorkoutExercise(row!, mapExercise(exercise));
}

export async function updateWorkoutExerciseLocal(
  programId: number,
  workoutId: number,
  itemId: number,
  input: Partial<WorkoutExerciseInput>,
) {
  const db = await getDb();
  const existing = await db.getFirstAsync<WorkoutExerciseRow>(
    `SELECT we.* FROM workout_exercises we
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.id = ? AND we.workout_id = ? AND w.program_id = ? AND we.deleted = 0`,
    [itemId, workoutId, programId],
  );
  if (!existing) throw new Error("Workout exercise not found");
  const dirty = existing.server_id != null ? 1 : 0;
  await db.runAsync(
    `UPDATE workout_exercises
     SET exercise_id = ?, sort_order = ?, sets = ?, reps = ?, rest_seconds = ?, notes = ?, dirty = ?
     WHERE id = ?`,
    [
      input.exerciseId ?? existing.exercise_id,
      input.sortOrder ?? existing.sort_order,
      input.sets ?? existing.sets,
      input.reps ?? existing.reps,
      input.restSeconds ?? existing.rest_seconds,
      input.notes ?? existing.notes,
      dirty,
      itemId,
    ],
  );
  const row = await db.getFirstAsync<WorkoutExerciseRow>(
    "SELECT * FROM workout_exercises WHERE id = ?",
    [itemId],
  );
  const exercise = await db.getFirstAsync<ExerciseRow>(
    "SELECT * FROM exercises WHERE id = ?",
    [row!.exercise_id],
  );
  return mapWorkoutExercise(row!, mapExercise(exercise!));
}

export async function removeWorkoutExerciseLocal(
  programId: number,
  workoutId: number,
  itemId: number,
) {
  const db = await getDb();
  const existing = await db.getFirstAsync<WorkoutExerciseRow>(
    `SELECT we.* FROM workout_exercises we
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.id = ? AND we.workout_id = ? AND w.program_id = ?`,
    [itemId, workoutId, programId],
  );
  if (!existing) return false;
  if (existing.server_id == null) {
    await db.runAsync("DELETE FROM workout_exercises WHERE id = ?", [itemId]);
  } else {
    await db.runAsync("UPDATE workout_exercises SET deleted = 1, dirty = 1 WHERE id = ?", [itemId]);
  }
  return true;
}

export async function getByServerId<T extends { server_id: number | null }>(
  table: SyncTable,
  serverId: number,
) {
  const db = await getDb();
  return db.getFirstAsync<T>(`SELECT * FROM ${table} WHERE server_id = ?`, [serverId]);
}

export async function setServerId(
  table: SyncTable,
  localId: number,
  serverId: number,
) {
  const db = await getDb();
  await db.runAsync(`UPDATE ${table} SET server_id = ?, dirty = 0 WHERE id = ?`, [
    serverId,
    localId,
  ]);
}

export async function pendingCreates(table: SyncTable) {
  const db = await getDb();
  return db.getAllAsync<{ id: number; server_id: number | null } & Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE server_id IS NULL AND deleted = 0`,
  );
}

export async function pendingUpdates(table: SyncTable) {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM ${table} WHERE dirty = 1 AND deleted = 0 AND server_id IS NOT NULL`);
}

export async function pendingDeletes(table: SyncTable) {
  const db = await getDb();
  return db.getAllAsync(`SELECT * FROM ${table} WHERE deleted = 1 AND server_id IS NOT NULL`);
}

export async function removeLocalRow(
  table: SyncTable,
  id: number,
) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

export async function clearDirty(
  table: SyncTable,
  id: number,
) {
  const db = await getDb();
  await db.runAsync(`UPDATE ${table} SET dirty = 0 WHERE id = ?`, [id]);
}

export async function upsertExerciseFromServer(exercise: Exercise) {
  const db = await getDb();
  const existing = await db.getFirstAsync<ExerciseRow>(
    "SELECT * FROM exercises WHERE server_id = ?",
    [exercise.id],
  );
  if (existing?.dirty || existing?.deleted) return existing.id;
  if (existing) {
    await db.runAsync(
      `UPDATE exercises SET name = ?, muscles = ?, equipment = ?, description = ?, source = ?, created_at = ?, dirty = 0
       WHERE id = ?`,
      [
        exercise.name,
        JSON.stringify(exercise.muscles),
        JSON.stringify(exercise.equipment),
        exercise.description,
        exercise.source,
        exercise.createdAt,
        existing.id,
      ],
    );
    return existing.id;
  }
  const result = await db.runAsync(
    `INSERT INTO exercises (server_id, name, muscles, equipment, description, source, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      exercise.id,
      exercise.name,
      JSON.stringify(exercise.muscles),
      JSON.stringify(exercise.equipment),
      exercise.description,
      exercise.source,
      exercise.createdAt,
    ],
  );
  return result.lastInsertRowId;
}

export async function upsertProgramFromServer(program: Program) {
  const db = await getDb();
  const existing = await db.getFirstAsync<ProgramRow>(
    "SELECT * FROM programs WHERE server_id = ?",
    [program.id],
  );
  if (existing?.dirty || existing?.deleted) return existing.id;
  if (existing) {
    await db.runAsync(
      `UPDATE programs SET title = ?, weeks = ?, notes = ?, status = ?, created_at = ?, dirty = 0 WHERE id = ?`,
      [program.title, program.weeks, program.notes, program.status, program.createdAt, existing.id],
    );
    return existing.id;
  }
  const result = await db.runAsync(
    `INSERT INTO programs (server_id, title, weeks, notes, status, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [program.id, program.title, program.weeks, program.notes, program.status, program.createdAt],
  );
  return result.lastInsertRowId;
}

export async function upsertWorkoutFromServer(
  localProgramId: number,
  workout: Omit<Workout, "exercises"> & { id: number },
) {
  const db = await getDb();
  const existing = await db.getFirstAsync<WorkoutRow>(
    "SELECT * FROM workouts WHERE server_id = ?",
    [workout.id],
  );
  if (existing?.dirty || existing?.deleted) return existing.id;
  if (existing) {
    await db.runAsync(
      `UPDATE workouts SET program_id = ?, week = ?, day_index = ?, label = ?, location = ?, dirty = 0 WHERE id = ?`,
      [localProgramId, workout.week, workout.dayIndex, workout.label, workout.location, existing.id],
    );
    return existing.id;
  }
  const result = await db.runAsync(
    `INSERT INTO workouts (server_id, program_id, week, day_index, label, location, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [workout.id, localProgramId, workout.week, workout.dayIndex, workout.label, workout.location],
  );
  return result.lastInsertRowId;
}

export async function upsertWorkoutExerciseFromServer(
  localWorkoutId: number,
  localExerciseId: number,
  item: WorkoutExercise,
) {
  const db = await getDb();
  const existing = await db.getFirstAsync<WorkoutExerciseRow>(
    "SELECT * FROM workout_exercises WHERE server_id = ?",
    [item.id],
  );
  if (existing?.dirty || existing?.deleted) return existing.id;
  if (existing) {
    await db.runAsync(
      `UPDATE workout_exercises
       SET workout_id = ?, exercise_id = ?, sort_order = ?, sets = ?, reps = ?, rest_seconds = ?, notes = ?, dirty = 0
       WHERE id = ?`,
      [
        localWorkoutId,
        localExerciseId,
        item.sortOrder,
        item.sets,
        item.reps,
        item.restSeconds,
        item.notes,
        existing.id,
      ],
    );
    return existing.id;
  }
  const result = await db.runAsync(
    `INSERT INTO workout_exercises (server_id, workout_id, exercise_id, sort_order, sets, reps, rest_seconds, notes, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      item.id,
      localWorkoutId,
      localExerciseId,
      item.sortOrder,
      item.sets,
      item.reps,
      item.restSeconds,
      item.notes,
    ],
  );
  return result.lastInsertRowId;
}

export async function upsertSessionFromServer(
  session: Session,
  localWorkoutId: number | null,
  localProgramId: number | null,
) {
  const db = await getDb();
  const existing = await db.getFirstAsync<SessionRow>(
    "SELECT * FROM sessions WHERE server_id = ?",
    [session.id],
  );
  if (existing?.dirty || existing?.deleted) return existing.id;
  if (existing) {
    await db.runAsync(
      `UPDATE sessions
       SET workout_id = ?, program_id = ?, week = ?, day_index = ?, location = ?, label = ?,
           program_title = ?, started_at = ?, ended_at = ?, duration_ms = ?, dirty = 0
       WHERE id = ?`,
      [
        localWorkoutId,
        localProgramId,
        session.week,
        session.dayIndex,
        session.location,
        session.label,
        session.programTitle,
        session.startedAt,
        session.endedAt,
        session.durationMs,
        existing.id,
      ],
    );
    return existing.id;
  }
  const result = await db.runAsync(
    `INSERT INTO sessions (
       server_id, workout_id, program_id, week, day_index, location, label, program_title,
       started_at, ended_at, duration_ms, dirty
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      session.id,
      localWorkoutId,
      localProgramId,
      session.week,
      session.dayIndex,
      session.location,
      session.label,
      session.programTitle,
      session.startedAt,
      session.endedAt,
      session.durationMs,
    ],
  );
  return result.lastInsertRowId;
}

export async function pruneMissingServerRows(
  table: SyncTable,
  serverIds: number[],
) {
  const db = await getDb();
  if (serverIds.length === 0) {
    await db.runAsync(
      `DELETE FROM ${table} WHERE server_id IS NOT NULL AND dirty = 0 AND deleted = 0`,
    );
    return;
  }
  const placeholders = serverIds.map(() => "?").join(",");
  await db.runAsync(
    `DELETE FROM ${table}
     WHERE server_id IS NOT NULL AND dirty = 0 AND deleted = 0 AND server_id NOT IN (${placeholders})`,
    serverIds,
  );
}

export async function getProgramByServerId(serverId: number) {
  const db = await getDb();
  const row = await db.getFirstAsync<ProgramRow>(
    "SELECT * FROM programs WHERE server_id = ? AND deleted = 0",
    [serverId],
  );
  if (!row) return null;
  return getProgramLocal(row.id);
}

export async function getWorkoutRow(id: number) {
  const db = await getDb();
  return db.getFirstAsync<WorkoutRow>("SELECT * FROM workouts WHERE id = ?", [id]);
}

export async function getExerciseRow(id: number) {
  const db = await getDb();
  return db.getFirstAsync<ExerciseRow>("SELECT * FROM exercises WHERE id = ?", [id]);
}

export async function getWorkoutExerciseRow(id: number) {
  const db = await getDb();
  return db.getFirstAsync<WorkoutExerciseRow>("SELECT * FROM workout_exercises WHERE id = ?", [id]);
}
