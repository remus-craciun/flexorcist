import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(databasePath: string) {
  if (dbInstance) return dbInstance;

  mkdirSync(dirname(databasePath), { recursive: true });
  const sqlite = new Database(databasePath, { create: true });
  sqlite.exec("PRAGMA foreign_keys = ON;");
  dbInstance = drizzle(sqlite, { schema });
  migrate(dbInstance, { migrationsFolder: resolve(import.meta.dir, "../../drizzle") });
  return dbInstance;
}

export type Db = ReturnType<typeof getDb>;
