import { Hono } from "hono";
import { cors } from "hono/cors";
import { getDb } from "./db";
import { loadEnv } from "./lib/env";
import { log } from "./lib/log";
import { requestLog } from "./middleware/request-log";
import { authRoutes } from "./routes/auth";
import { exerciseRoutes } from "./routes/exercises";
import { profileRoutes } from "./routes/profile";
import { programRoutes } from "./routes/programs";
import { sessionRoutes } from "./routes/sessions";
import { syncRoutes } from "./routes/sync";

const env = loadEnv();
const db = getDb(env.DATABASE_PATH);

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use("*", requestLog());

app.onError((err, c) => {
  log.error("http.unhandled", {
    method: c.req.method,
    path: c.req.path,
    error: err.message,
  });
  return c.json({ error: "Internal server error" }, 500);
});

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", authRoutes(db, env));
app.route("/profile", profileRoutes(db, env.JWT_SECRET));
app.route("/sync", syncRoutes(db, env.JWT_SECRET));
app.route("/sessions", sessionRoutes(db, env.JWT_SECRET));
app.route("/exercises", exerciseRoutes(db, env.JWT_SECRET));
app.route("/programs", programRoutes(db, env));

console.log(`Flexorcist API listening on http://0.0.0.0:${env.PORT}`);
log.info("server.started", {
  port: env.PORT,
  geminiModel: env.GEMINI_MODEL,
  geminiConfigured: Boolean(env.GEMINI_API_KEY),
});

export default {
  port: env.PORT,
  hostname: "0.0.0.0",
  fetch: app.fetch,
};
