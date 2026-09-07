import { createMiddleware } from "hono/factory";
import { jwt } from "hono/jwt";
import type { Env } from "../lib/env";

export type AuthVariables = {
  jwtPayload: {
    sub: number;
    email: string;
  };
};

export function authMiddleware(jwtSecret: string) {
  return jwt({ secret: jwtSecret, alg: "HS256" });
}

export function requireAuth() {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const payload = c.get("jwtPayload");
    if (!payload?.sub || !payload?.email) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });
}

export type AppEnv = {
  Bindings: Env;
  Variables: AuthVariables;
};
