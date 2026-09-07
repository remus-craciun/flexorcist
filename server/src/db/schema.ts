import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** Fitness questionnaire used later for AI program generation. */
export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  sex: text("sex", { enum: ["male", "female", "other"] }),
  age: integer("age"),
  heightCm: integer("height_cm"),
  weightKg: integer("weight_kg"),
  experience: text("experience", {
    enum: ["beginner", "intermediate", "advanced"],
  }),
  goals: text("goals", { mode: "json" }).$type<string[]>().notNull().default([]),
  daysPerWeek: integer("days_per_week"),
  limitations: text("limitations").notNull().default(""),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const exercises = sqliteTable("exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  muscles: text("muscles", { mode: "json" }).$type<string[]>().notNull().default([]),
  equipment: text("equipment", { mode: "json" }).$type<string[]>().notNull().default([]),
  description: text("description").notNull().default(""),
  source: text("source", { enum: ["ai", "user"] }).notNull().default("user"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const programs = sqliteTable("programs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  weeks: integer("weeks").notNull(),
  notes: text("notes").notNull().default(""),
  status: text("status", { enum: ["draft", "active", "archived"] })
    .notNull()
    .default("draft"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Hierarchy: Program → Workout → Exercise (via workout_exercises).
 * Location variants (home / park / gym) are separate workouts sharing week + day.
 */
export const workouts = sqliteTable(
  "workouts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    week: integer("week").notNull(),
    dayIndex: integer("day_index").notNull(),
    label: text("label"),
    /** home: no equipment; park: bars OK, no floor work; gym: unrestricted */
    location: text("location", { enum: ["home", "park", "gym"] }).notNull(),
  },
  (table) => [
    uniqueIndex("workouts_program_week_day_location_idx").on(
      table.programId,
      table.week,
      table.dayIndex,
      table.location,
    ),
  ],
);

export const workoutExercises = sqliteTable("workout_exercises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workoutId: integer("workout_id")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull().default(0),
  sets: integer("sets").notNull().default(3),
  reps: text("reps").notNull().default("8-12"),
  restSeconds: integer("rest_seconds").notNull().default(90),
  notes: text("notes").notNull().default(""),
});

/** Completed training sessions. Snapshot fields survive workout/program edits. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workoutId: integer("workout_id").references(() => workouts.id, { onDelete: "set null" }),
    programId: integer("program_id").references(() => programs.id, { onDelete: "set null" }),
    week: integer("week").notNull(),
    dayIndex: integer("day_index").notNull(),
    location: text("location", { enum: ["home", "park", "gym"] }).notNull(),
    label: text("label"),
    programTitle: text("program_title").notNull().default(""),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at").notNull(),
    durationMs: integer("duration_ms").notNull(),
  },
  (table) => [index("sessions_started_at_idx").on(table.startedAt)],
);

export const usersRelations = relations(users, ({ one }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const exercisesRelations = relations(exercises, ({ many }) => ({
  workoutExercises: many(workoutExercises),
}));

export const programsRelations = relations(programs, ({ many }) => ({
  workouts: many(workouts),
  sessions: many(sessions),
}));

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  program: one(programs, {
    fields: [workouts.programId],
    references: [programs.id],
  }),
  workoutExercises: many(workoutExercises),
  sessions: many(sessions),
}));

export const workoutExercisesRelations = relations(workoutExercises, ({ one }) => ({
  workout: one(workouts, {
    fields: [workoutExercises.workoutId],
    references: [workouts.id],
  }),
  exercise: one(exercises, {
    fields: [workoutExercises.exerciseId],
    references: [exercises.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  workout: one(workouts, {
    fields: [sessions.workoutId],
    references: [workouts.id],
  }),
  program: one(programs, {
    fields: [sessions.programId],
    references: [programs.id],
  }),
}));
