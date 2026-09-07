import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnv } from "../lib/env";

const env = loadEnv();
const databasePath = resolve(env.DATABASE_PATH);

mkdirSync(dirname(databasePath), { recursive: true });
const sqlite = new Database(databasePath, { create: true });
sqlite.exec("PRAGMA foreign_keys = ON;");

const db = drizzle(sqlite);
migrate(db, { migrationsFolder: resolve(import.meta.dir, "../../drizzle") });

console.log(`Migrated database at ${databasePath}`);
