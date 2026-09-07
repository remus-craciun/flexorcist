import { Hono } from "hono";
import { asc, desc } from "drizzle-orm";
import type { Db } from "../db";
import { exercises, programs, sessions } from "../db/schema";
import { log } from "../lib/log";
import { authMiddleware, requireAuth, type AppEnv } from "../middleware/auth";
import { loadProgramDetail } from "./programs";

export function syncRoutes(db: Db, jwtSecret: string) {
  const app = new Hono<AppEnv>();

  app.use("*", authMiddleware(jwtSecret), requireAuth());

  app.get("/", async (c) => {
    const exerciseRows = db.select().from(exercises).orderBy(asc(exercises.id)).all();
    const programRows = db.select().from(programs).orderBy(asc(programs.id)).all();
    const programDetails = programRows.map((row) => loadProgramDetail(db, row.id)!);
    const sessionRows = db.select().from(sessions).orderBy(desc(sessions.endedAt)).all();

    log.info("sync.snapshot", {
      exercises: exerciseRows.length,
      programs: programDetails.length,
      sessions: sessionRows.length,
    });

    return c.json({ exercises: exerciseRows, programs: programDetails, sessions: sessionRows });
  });

  return app;
}
