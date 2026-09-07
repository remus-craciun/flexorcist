import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db";
import { exercises, workoutExercises } from "../db/schema";
import { log } from "../lib/log";
import { authMiddleware, requireAuth, type AppEnv } from "../middleware/auth";

const exerciseBodySchema = z.object({
  name: z.string().min(1).max(200),
  muscles: z.array(z.string().min(1)).default([]),
  equipment: z.array(z.string().min(1)).default([]),
  description: z.string().default(""),
  source: z.enum(["ai", "user"]).default("user"),
});

const exerciseUpdateSchema = exerciseBodySchema.partial();

export function exerciseRoutes(db: Db, jwtSecret: string) {
  const app = new Hono<AppEnv>();

  app.use("*", authMiddleware(jwtSecret), requireAuth());

  app.get("/", async (c) => {
    const muscle = c.req.query("muscle");
    const equipment = c.req.query("equipment");

    let rows = db.select().from(exercises).all();

    if (muscle) {
      const needle = muscle.toLowerCase();
      rows = rows.filter((row) =>
        row.muscles.some((m) => m.toLowerCase().includes(needle)),
      );
    }

    if (equipment) {
      const needle = equipment.toLowerCase();
      rows = rows.filter((row) =>
        row.equipment.some((e) => e.toLowerCase().includes(needle)),
      );
    }

    return c.json({ exercises: rows });
  });

  app.get("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);

    const row = db.select().from(exercises).where(eq(exercises.id, id)).get();
    if (!row) return c.json({ error: "Exercise not found" }, 404);
    return c.json({ exercise: row });
  });

  app.post("/", async (c) => {
    const body = exerciseBodySchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid exercise", details: body.error.flatten() }, 400);
    }

    const row = db.insert(exercises).values(body.data).returning().get();
    log.info("exercise.created", { id: row.id, name: row.name, source: row.source });
    return c.json({ exercise: row }, 201);
  });

  app.patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);

    const body = exerciseUpdateSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid exercise", details: body.error.flatten() }, 400);
    }

    const existing = db.select().from(exercises).where(eq(exercises.id, id)).get();
    if (!existing) return c.json({ error: "Exercise not found" }, 404);

    const row = db.update(exercises).set(body.data).where(eq(exercises.id, id)).returning().get();
    log.info("exercise.updated", { id: row.id, name: row.name });
    return c.json({ exercise: row });
  });

  app.delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "Invalid id" }, 400);

    const existing = db.select().from(exercises).where(eq(exercises.id, id)).get();
    if (!existing) return c.json({ error: "Exercise not found" }, 404);

    db.delete(workoutExercises).where(eq(workoutExercises.exerciseId, id)).run();
    db.delete(exercises).where(eq(exercises.id, id)).run();
    log.info("exercise.deleted", { id, name: existing.name });
    return c.json({ ok: true });
  });

  return app;
}
