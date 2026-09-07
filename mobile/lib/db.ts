import * as SQLite from "expo-sqlite";

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  muscles TEXT NOT NULL DEFAULT '[]',
  equipment TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER UNIQUE,
  title TEXT NOT NULL,
  weeks INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER UNIQUE,
  program_id INTEGER NOT NULL,
  week INTEGER NOT NULL,
  day_index INTEGER NOT NULL,
  label TEXT,
  location TEXT NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER UNIQUE,
  workout_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  sets INTEGER NOT NULL DEFAULT 3,
  reps TEXT NOT NULL DEFAULT '8-12',
  rest_seconds INTEGER NOT NULL DEFAULT 90,
  notes TEXT NOT NULL DEFAULT '',
  dirty INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS workouts_program_idx ON workouts (program_id);
CREATE INDEX IF NOT EXISTS workout_exercises_workout_idx ON workout_exercises (workout_id);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id INTEGER UNIQUE,
  workout_id INTEGER,
  program_id INTEGER,
  week INTEGER NOT NULL,
  day_index INTEGER NOT NULL,
  location TEXT NOT NULL,
  label TEXT,
  program_title TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  dirty INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sessions_started_idx ON sessions (started_at);
`;

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb() {
  if (!opening) {
    opening = (async () => {
      const db = await SQLite.openDatabaseAsync("flexorcist.db");
      await db.execAsync(SCHEMA);
      return db;
    })();
  }
  return opening;
}
