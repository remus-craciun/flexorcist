import { and, asc, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db";
import { exercises, programs, workoutExercises, workouts } from "../db/schema";
import type { Env } from "../lib/env";
import { GenerateError, generateAndPersistProgram, generateRequestSchema } from "../lib/generate-program";
import { log } from "../lib/log";
import { authMiddleware, requireAuth, type AppEnv } from "../middleware/auth";

const LOCATIONS = ["home", "park", "gym"] as const;

const programBodySchema = z.object({
  title: z.string().min(1).max(200),
  weeks: z.number().int().min(1).max(4),
  notes: z.string().default(""),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
});

const programUpdateSchema = programBodySchema.partial();

/** Creates the three location variants for a training slot. */
const trainingDaySchema = z.object({
  week: z.number().int().min(1).max(4),
  dayIndex: z.number().int().min(1).max(7),
  label: z.string().optional().nullable(),
});

const workoutBodySchema = z.object({
  week: z.number().int().min(1).max(4),
  dayIndex: z.number().int().min(1).max(7),
  label: z.string().optional().nullable(),
  location: z.enum(LOCATIONS),
});

const workoutUpdateSchema = z.object({
  week: z.number().int().min(1).max(4).optional(),
  dayIndex: z.number().int().min(1).max(7).optional(),
  label: z.string().optional().nullable(),
  location: z.enum(LOCATIONS).optional(),
});

const workoutExerciseBodySchema = z.object({
  exerciseId: z.number().int().positive(),
  sortOrder: z.number().int().min(0).default(0),
  sets: z.number().int().min(1).default(3),
  reps: z.string().min(1).default("8-12"),
  restSeconds: z.number().int().min(0).default(90),
  notes: z.string().default(""),
});

const workoutExerciseUpdateSchema = workoutExerciseBodySchema.partial();

function loadWorkoutExercises(db: Db, workoutId: number) {
  const items = db
    .select({
      id: workoutExercises.id,
      workoutId: workoutExercises.workoutId,
      exerciseId: workoutExercises.exerciseId,
      sortOrder: workoutExercises.sortOrder,
      sets: workoutExercises.sets,
      reps: workoutExercises.reps,
      restSeconds: workoutExercises.restSeconds,
      notes: workoutExercises.notes,
      exercise: exercises,
    })
    .from(workoutExercises)
    .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
    .where(eq(workoutExercises.workoutId, workoutId))
    .orderBy(asc(workoutExercises.sortOrder))
    .all();

  return items.map(({ exercise, ...item }) => ({ ...item, exercise }));
}

export function loadWorkoutDetail(db: Db, workoutId: number) {
  const workout = db.select().from(workouts).where(eq(workouts.id, workoutId)).get();
  if (!workout) return null;
  return { ...workout, exercises: loadWorkoutExercises(db, workout.id) };
}

export function loadProgramDetail(db: Db, programId: number) {
  const program = db.select().from(programs).where(eq(programs.id, programId)).get();
  if (!program) return null;

  const programWorkouts = db
    .select()
    .from(workouts)
    .where(eq(workouts.programId, programId))
    .orderBy(asc(workouts.week), asc(workouts.dayIndex), asc(workouts.location))
    .all();

  return {
    ...program,
    workouts: programWorkouts.map((workout) => ({
      ...workout,
      exercises: loadWorkoutExercises(db, workout.id),
    })),
  };
}

function requireProgramWorkout(db: Db, programId: number, workoutId: number) {
  const workout = db.select().from(workouts).where(eq(workouts.id, workoutId)).get();
  if (!workout || workout.programId !== programId) return null;
  return workout;
}

/** Home follows a single active program. */
function followExclusive(db: Db, programId: number) {
  db.update(programs)
    .set({ status: "draft" })
    .where(and(eq(programs.status, "active"), ne(programs.id, programId)))
    .returning()
    .all();
}

export function programRoutes(db: Db, env: Env) {
  const app = new Hono<AppEnv>();

  app.use("*", authMiddleware(env.JWT_SECRET), requireAuth());

  app.post("/generate", async (c) => {
    let payload: unknown = {};
    try {
      payload = await c.req.json();
    } catch {
      payload = {};
    }

    const body = generateRequestSchema.safeParse(payload);
    if (!body.success) {
      log.warn("program.generate.invalid", { userId: Number(c.get("jwtPayload")?.sub), details: body.error.flatten() });
      return c.json({ error: "Invalid generate request", details: body.error.flatten() }, 400);
    }

    const userId = Number(c.get("jwtPayload").sub);
    if (!Number.isInteger(userId)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    log.info("program.generate.started", {
      userId,
      weeks: body.data.weeks,
      volume: body.data.volume,
    });

    try {
      const { programId, createdExerciseCount } = await generateAndPersistProgram(
        db,
        env,
        userId,
        body.data,
      );
      const program = loadProgramDetail(db, programId);
      log.info("program.generate.succeeded", {
        userId,
        programId,
        createdExerciseCount,
        workouts: program?.workouts.length ?? 0,
      });
      return c.json({ program, createdExerciseCount }, 201);
    } catch (err) {
      log.error("program.generate.failed", {
        userId,
        error: err instanceof Error ? err.message : "unknown",
        status: err instanceof GenerateError ? err.status : 502,
      });
      if (err instanceof GenerateError) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: "Program generation failed" }, 502);
    }
  });

  app.get("/", async (c) => {
    const rows = db.select().from(programs).orderBy(asc(programs.id)).all();
    return c.json({ programs: rows });
  });

  app.get("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);

    const detail = loadProgramDetail(db, id);
    if (!detail) return c.json({ error: "Program not found" }, 404);
    return c.json({ program: detail });
  });

  app.post("/", async (c) => {
    const body = programBodySchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid program", details: body.error.flatten() }, 400);
    }

    const row = db.insert(programs).values(body.data).returning().get();
    if (row.status === "active") followExclusive(db, row.id);
    log.info("program.created", { id: row.id, title: row.title, weeks: row.weeks, status: row.status });
    return c.json({ program: row }, 201);
  });

  app.patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);

    const body = programUpdateSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid program", details: body.error.flatten() }, 400);
    }

    const existing = db.select().from(programs).where(eq(programs.id, id)).get();
    if (!existing) return c.json({ error: "Program not found" }, 404);

    const row = db.update(programs).set(body.data).where(eq(programs.id, id)).returning().get();
    if (row.status === "active") followExclusive(db, row.id);
    log.info("program.updated", { id: row.id, title: row.title, status: row.status });
    return c.json({ program: row });
  });

  app.delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);

    const existing = db.select().from(programs).where(eq(programs.id, id)).get();
    if (!existing) return c.json({ error: "Program not found" }, 404);

    db.delete(programs).where(eq(programs.id, id)).run();
    log.info("program.deleted", { id, title: existing.title });
    return c.json({ ok: true });
  });

  /**
   * Seed home + park + gym workouts for a week/day slot.
   * POST /programs/:id/workouts/day
   */
  app.post("/:id/workouts/day", async (c) => {
    const programId = Number(c.req.param("id"));
    if (!Number.isInteger(programId)) return c.json({ error: "Invalid id" }, 400);

    const program = db.select().from(programs).where(eq(programs.id, programId)).get();
    if (!program) return c.json({ error: "Program not found" }, 404);

    const body = trainingDaySchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid training day", details: body.error.flatten() }, 400);
    }

    if (body.data.week > program.weeks) {
      return c.json({ error: `Week must be between 1 and ${program.weeks}` }, 400);
    }

    const existing = db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.programId, programId),
          eq(workouts.week, body.data.week),
          eq(workouts.dayIndex, body.data.dayIndex),
        ),
      )
      .all();

    if (existing.length > 0) {
      return c.json({ error: "Workouts already exist for this week and day" }, 409);
    }

    const seeded = LOCATIONS.map((location) =>
      db
        .insert(workouts)
        .values({
          programId,
          week: body.data.week,
          dayIndex: body.data.dayIndex,
          label: body.data.label ?? null,
          location,
        })
        .returning()
        .get(),
    );

    log.info("workout.day.seeded", {
      programId,
      week: body.data.week,
      dayIndex: body.data.dayIndex,
      count: seeded.length,
    });

    return c.json({
      workouts: seeded.map((workout) => ({ ...workout, exercises: [] })),
    }, 201);
  });

  app.post("/:id/workouts", async (c) => {
    const programId = Number(c.req.param("id"));
    if (!Number.isInteger(programId)) return c.json({ error: "Invalid id" }, 400);

    const program = db.select().from(programs).where(eq(programs.id, programId)).get();
    if (!program) return c.json({ error: "Program not found" }, 404);

    const body = workoutBodySchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid workout", details: body.error.flatten() }, 400);
    }

    if (body.data.week > program.weeks) {
      return c.json({ error: `Week must be between 1 and ${program.weeks}` }, 400);
    }

    try {
      const row = db
        .insert(workouts)
        .values({
          programId,
          week: body.data.week,
          dayIndex: body.data.dayIndex,
          label: body.data.label ?? null,
          location: body.data.location,
        })
        .returning()
        .get();

      log.info("workout.created", {
        id: row.id,
        programId,
        week: row.week,
        dayIndex: row.dayIndex,
        location: row.location,
      });

      return c.json({ workout: { ...row, exercises: [] } }, 201);
    } catch {
      return c.json({ error: "A workout with this week, day, and location already exists" }, 409);
    }
  });

  app.get("/:programId/workouts/:workoutId", async (c) => {
    const programId = Number(c.req.param("programId"));
    const workoutId = Number(c.req.param("workoutId"));
    if (!Number.isInteger(programId) || !Number.isInteger(workoutId)) {
      return c.json({ error: "Invalid id" }, 400);
    }

    if (!requireProgramWorkout(db, programId, workoutId)) {
      return c.json({ error: "Workout not found" }, 404);
    }

    const detail = loadWorkoutDetail(db, workoutId);
    return c.json({ workout: detail });
  });

  app.patch("/:programId/workouts/:workoutId", async (c) => {
    const programId = Number(c.req.param("programId"));
    const workoutId = Number(c.req.param("workoutId"));
    if (!Number.isInteger(programId) || !Number.isInteger(workoutId)) {
      return c.json({ error: "Invalid id" }, 400);
    }

    const existing = requireProgramWorkout(db, programId, workoutId);
    if (!existing) return c.json({ error: "Workout not found" }, 404);

    const body = workoutUpdateSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid workout", details: body.error.flatten() }, 400);
    }

    const program = db.select().from(programs).where(eq(programs.id, programId)).get();
    if (!program) return c.json({ error: "Program not found" }, 404);

    const nextWeek = body.data.week ?? existing.week;
    if (nextWeek > program.weeks) {
      return c.json({ error: `Week must be between 1 and ${program.weeks}` }, 400);
    }

    try {
      const row = db
        .update(workouts)
        .set({
          week: nextWeek,
          dayIndex: body.data.dayIndex ?? existing.dayIndex,
          label: body.data.label === undefined ? existing.label : body.data.label,
          location: body.data.location ?? existing.location,
        })
        .where(eq(workouts.id, workoutId))
        .returning()
        .get();

      log.info("workout.updated", { id: row.id, programId, location: row.location });

      return c.json({ workout: { ...row, exercises: loadWorkoutExercises(db, workoutId) } });
    } catch {
      return c.json({ error: "A workout with this week, day, and location already exists" }, 409);
    }
  });

  app.delete("/:programId/workouts/:workoutId", async (c) => {
    const programId = Number(c.req.param("programId"));
    const workoutId = Number(c.req.param("workoutId"));
    if (!Number.isInteger(programId) || !Number.isInteger(workoutId)) {
      return c.json({ error: "Invalid id" }, 400);
    }

    if (!requireProgramWorkout(db, programId, workoutId)) {
      return c.json({ error: "Workout not found" }, 404);
    }

    db.delete(workouts).where(eq(workouts.id, workoutId)).run();
    log.info("workout.deleted", { programId, workoutId });
    return c.json({ ok: true });
  });

  app.post("/:programId/workouts/:workoutId/exercises", async (c) => {
    const programId = Number(c.req.param("programId"));
    const workoutId = Number(c.req.param("workoutId"));
    if (!Number.isInteger(programId) || !Number.isInteger(workoutId)) {
      return c.json({ error: "Invalid id" }, 400);
    }

    if (!requireProgramWorkout(db, programId, workoutId)) {
      return c.json({ error: "Workout not found" }, 404);
    }

    const body = workoutExerciseBodySchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid workout exercise", details: body.error.flatten() }, 400);
    }

    const exercise = db
      .select()
      .from(exercises)
      .where(eq(exercises.id, body.data.exerciseId))
      .get();
    if (!exercise) return c.json({ error: "Exercise not found" }, 404);

    const row = db
      .insert(workoutExercises)
      .values({
        workoutId,
        exerciseId: body.data.exerciseId,
        sortOrder: body.data.sortOrder,
        sets: body.data.sets,
        reps: body.data.reps,
        restSeconds: body.data.restSeconds,
        notes: body.data.notes,
      })
      .returning()
      .get();

    log.info("workout.exercise.added", {
      programId,
      workoutId,
      exerciseId: row.exerciseId,
      name: exercise.name,
    });

    return c.json({ workoutExercise: { ...row, exercise } }, 201);
  });

  app.patch("/:programId/workouts/:workoutId/exercises/:itemId", async (c) => {
    const programId = Number(c.req.param("programId"));
    const workoutId = Number(c.req.param("workoutId"));
    const itemId = Number(c.req.param("itemId"));
    if (![programId, workoutId, itemId].every(Number.isInteger)) {
      return c.json({ error: "Invalid id" }, 400);
    }

    if (!requireProgramWorkout(db, programId, workoutId)) {
      return c.json({ error: "Workout not found" }, 404);
    }

    const item = db
      .select()
      .from(workoutExercises)
      .where(eq(workoutExercises.id, itemId))
      .get();
    if (!item || item.workoutId !== workoutId) {
      return c.json({ error: "Workout exercise not found" }, 404);
    }

    const body = workoutExerciseUpdateSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid workout exercise", details: body.error.flatten() }, 400);
    }

    if (body.data.exerciseId != null) {
      const exercise = db
        .select()
        .from(exercises)
        .where(eq(exercises.id, body.data.exerciseId))
        .get();
      if (!exercise) return c.json({ error: "Exercise not found" }, 404);
    }

    const row = db
      .update(workoutExercises)
      .set(body.data)
      .where(eq(workoutExercises.id, itemId))
      .returning()
      .get();

    const exercise = db
      .select()
      .from(exercises)
      .where(eq(exercises.id, row.exerciseId))
      .get();

    log.info("workout.exercise.updated", { programId, workoutId, itemId, exerciseId: row.exerciseId });

    return c.json({ workoutExercise: { ...row, exercise } });
  });

  app.delete("/:programId/workouts/:workoutId/exercises/:itemId", async (c) => {
    const programId = Number(c.req.param("programId"));
    const workoutId = Number(c.req.param("workoutId"));
    const itemId = Number(c.req.param("itemId"));
    if (![programId, workoutId, itemId].every(Number.isInteger)) {
      return c.json({ error: "Invalid id" }, 400);
    }

    if (!requireProgramWorkout(db, programId, workoutId)) {
      return c.json({ error: "Workout not found" }, 404);
    }

    const item = db
      .select()
      .from(workoutExercises)
      .where(eq(workoutExercises.id, itemId))
      .get();
    if (!item || item.workoutId !== workoutId) {
      return c.json({ error: "Workout exercise not found" }, 404);
    }

    db.delete(workoutExercises).where(eq(workoutExercises.id, itemId)).run();
    log.info("workout.exercise.removed", { programId, workoutId, itemId, exerciseId: item.exerciseId });
    return c.json({ ok: true });
  });

  return app;
}
