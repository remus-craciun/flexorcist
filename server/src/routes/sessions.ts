import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db";
import { programs, sessions, workouts } from "../db/schema";
import { log } from "../lib/log";
import { authMiddleware, requireAuth, type AppEnv } from "../middleware/auth";

const sessionBodySchema = z.object({
  workoutId: z.number().int().positive().optional().nullable(),
  programId: z.number().int().positive().optional().nullable(),
  week: z.number().int().min(1).max(4).optional(),
  dayIndex: z.number().int().min(1).max(7).optional(),
  location: z.enum(["home", "park", "gym"]).optional(),
  label: z.string().nullable().optional(),
  programTitle: z.string().optional(),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationMs: z.number().int().min(0).max(7 * 24 * 60 * 60 * 1000),
});

function parseStamp(value: string) {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export function sessionRoutes(db: Db, jwtSecret: string) {
  const app = new Hono<AppEnv>();

  app.use("*", authMiddleware(jwtSecret), requireAuth());

  app.get("/", (c) => {
    const rows = db.select().from(sessions).orderBy(desc(sessions.endedAt)).all();
    return c.json({ sessions: rows });
  });

  app.post("/", async (c) => {
    const body = sessionBodySchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid session", details: body.error.flatten() }, 400);
    }

    const startedMs = parseStamp(body.data.startedAt);
    const endedMs = parseStamp(body.data.endedAt);
    if (startedMs == null || endedMs == null || endedMs < startedMs) {
      return c.json({ error: "Invalid session timestamps" }, 400);
    }

    const workout = body.data.workoutId
      ? db.select().from(workouts).where(eq(workouts.id, body.data.workoutId)).get()
      : null;
    if (body.data.workoutId && !workout) {
      return c.json({ error: "Workout not found" }, 404);
    }

    const programId = workout?.programId ?? body.data.programId ?? null;
    const program = programId
      ? db.select().from(programs).where(eq(programs.id, programId)).get()
      : null;

    const week = workout?.week ?? body.data.week;
    const dayIndex = workout?.dayIndex ?? body.data.dayIndex;
    const location = workout?.location ?? body.data.location;
    if (week == null || dayIndex == null || !location) {
      return c.json({ error: "Session is missing workout details" }, 400);
    }

    const row = db
      .insert(sessions)
      .values({
        workoutId: workout?.id ?? null,
        programId: program?.id ?? null,
        week,
        dayIndex,
        location,
        label: workout?.label ?? body.data.label ?? null,
        programTitle: program?.title ?? body.data.programTitle ?? "",
        startedAt: new Date(startedMs).toISOString(),
        endedAt: new Date(endedMs).toISOString(),
        durationMs: body.data.durationMs,
      })
      .returning()
      .get();

    log.info("session.created", {
      id: row.id,
      workoutId: row.workoutId,
      durationMs: row.durationMs,
    });
    return c.json({ session: row }, 201);
  });

  return app;
}
