import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db";
import { profiles } from "../db/schema";
import { log } from "../lib/log";
import { authMiddleware, requireAuth, type AppEnv } from "../middleware/auth";

const GOAL_OPTIONS = [
  "strength",
  "hypertrophy",
  "endurance",
  "fat_loss",
  "general_fitness",
  "mobility",
] as const;

const profileBodySchema = z.object({
  sex: z.enum(["male", "female", "other"]).nullable().optional(),
  age: z.number().int().min(13).max(100).nullable().optional(),
  heightCm: z.number().int().min(100).max(250).nullable().optional(),
  weightKg: z.number().int().min(30).max(300).nullable().optional(),
  experience: z.enum(["beginner", "intermediate", "advanced"]).nullable().optional(),
  goals: z.array(z.enum(GOAL_OPTIONS)).max(6).optional(),
  daysPerWeek: z.number().int().min(1).max(7).nullable().optional(),
  limitations: z.string().max(2000).optional(),
});

function emptyProfile(userId: number) {
  return {
    id: null,
    userId,
    sex: null,
    age: null,
    heightCm: null,
    weightKg: null,
    experience: null,
    goals: [] as string[],
    daysPerWeek: null,
    limitations: "",
    updatedAt: null,
  };
}

export function profileRoutes(db: Db, jwtSecret: string) {
  const app = new Hono<AppEnv>();

  app.use("*", authMiddleware(jwtSecret), requireAuth());

  app.get("/", async (c) => {
    const userId = Number(c.get("jwtPayload").sub);
    const row = db.select().from(profiles).where(eq(profiles.userId, userId)).get();
    return c.json({ profile: row ?? emptyProfile(userId) });
  });

  app.put("/", async (c) => {
    const userId = Number(c.get("jwtPayload").sub);
    const body = profileBodySchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid profile", details: body.error.flatten() }, 400);
    }

    const existing = db.select().from(profiles).where(eq(profiles.userId, userId)).get();
    const values = {
      sex: body.data.sex ?? null,
      age: body.data.age ?? null,
      heightCm: body.data.heightCm ?? null,
      weightKg: body.data.weightKg ?? null,
      experience: body.data.experience ?? null,
      goals: body.data.goals ?? [],
      daysPerWeek: body.data.daysPerWeek ?? null,
      limitations: body.data.limitations ?? "",
      updatedAt: sql`(datetime('now'))`,
    };

    const row = existing
      ? db.update(profiles).set(values).where(eq(profiles.userId, userId)).returning().get()
      : db
          .insert(profiles)
          .values({ userId, ...values })
          .returning()
          .get();

    log.info("profile.saved", {
      userId,
      created: !existing,
      experience: row.experience,
      daysPerWeek: row.daysPerWeek,
    });

    return c.json({ profile: row });
  });

  return app;
}
