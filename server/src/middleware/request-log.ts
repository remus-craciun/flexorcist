import { createMiddleware } from "hono/factory";
import { log } from "../lib/log";

const SKIP = new Set(["OPTIONS"]);

export function requestLog() {
  return createMiddleware(async (c, next) => {
    const started = performance.now();
    await next();

    if (SKIP.has(c.req.method)) return;
    if (c.req.method === "GET" && c.req.path === "/health") return;

    const payload = c.get("jwtPayload") as { sub?: number; email?: string } | undefined;
    log.info("http.request", {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - started),
      userId: payload?.sub,
    });
  });
}
