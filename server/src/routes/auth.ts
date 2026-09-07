import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { z } from "zod";
import type { Db } from "../db";
import { users } from "../db/schema";
import type { Env } from "../lib/env";
import { log } from "../lib/log";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

function publicUser(row: typeof users.$inferSelect) {
  return { id: row.id, email: row.email, createdAt: row.createdAt };
}

export function authRoutes(db: Db, env: Env) {
  const app = new Hono();

  app.get("/status", async (c) => {
    const result = db.select({ count: sql<number>`count(*)` }).from(users).get();
    return c.json({ hasUser: (result?.count ?? 0) > 0 });
  });

  app.post("/register", async (c) => {
    const body = credentialsSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid credentials", details: body.error.flatten() }, 400);
    }

    const existing = db.select({ count: sql<number>`count(*)` }).from(users).get();
    if ((existing?.count ?? 0) > 0) {
      log.warn("auth.register.blocked", { email: body.data.email.toLowerCase() });
      return c.json({ error: "Registration is disabled; a user already exists" }, 403);
    }

    const passwordHash = await Bun.password.hash(body.data.password);
    const inserted = db
      .insert(users)
      .values({
        email: body.data.email.toLowerCase(),
        passwordHash,
      })
      .returning()
      .get();

    const token = await sign(
      {
        sub: inserted.id,
        email: inserted.email,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      },
      env.JWT_SECRET,
      "HS256",
    );

    log.info("auth.registered", { userId: inserted.id, email: inserted.email });

    return c.json({ token, user: publicUser(inserted) }, 201);
  });

  app.post("/login", async (c) => {
    const body = credentialsSchema.safeParse(await c.req.json());
    if (!body.success) {
      return c.json({ error: "Invalid credentials", details: body.error.flatten() }, 400);
    }

    const user = db
      .select()
      .from(users)
      .where(eq(users.email, body.data.email.toLowerCase()))
      .get();

    if (!user) {
      log.warn("auth.login.failed", { email: body.data.email.toLowerCase(), reason: "unknown_user" });
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const valid = await Bun.password.verify(body.data.password, user.passwordHash);
    if (!valid) {
      log.warn("auth.login.failed", { email: user.email, reason: "bad_password" });
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const token = await sign(
      {
        sub: user.id,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      },
      env.JWT_SECRET,
      "HS256",
    );

    log.info("auth.login", { userId: user.id, email: user.email });

    return c.json({ token, user: publicUser(user) });
  });

  return app;
}
