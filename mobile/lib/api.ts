export { ApiError, apiRequest } from "./http";

export type AuthUser = {
  id: number;
  email: string;
  createdAt: string;
};

export type AuthStatus = { hasUser: boolean };
export type AuthResponse = { token: string; user: AuthUser };

export type Exercise = {
  id: number;
  name: string;
  muscles: string[];
  equipment: string[];
  description: string;
  source: "ai" | "user";
  createdAt: string;
};

export type ProgramStatus = "draft" | "active" | "archived";

export type Program = {
  id: number;
  title: string;
  weeks: number;
  notes: string;
  status: ProgramStatus;
  createdAt: string;
};

export type ProgramInput = {
  title: string;
  weeks: number;
  notes: string;
  status: ProgramStatus;
};

export type WorkoutExercise = {
  id: number;
  workoutId: number;
  exerciseId: number;
  sortOrder: number;
  sets: number;
  reps: string;
  restSeconds: number;
  notes: string;
  exercise: Exercise;
};

export type Workout = {
  id: number;
  programId: number;
  week: number;
  dayIndex: number;
  label: string | null;
  location: "home" | "park" | "gym";
  exercises: WorkoutExercise[];
};

export type ProgramDetail = Program & {
  workouts: Workout[];
};

export type Session = {
  id: number;
  workoutId: number | null;
  programId: number | null;
  week: number;
  dayIndex: number;
  location: "home" | "park" | "gym";
  label: string | null;
  programTitle: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export type SessionInput = {
  workoutId: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export type WorkoutInput = {
  week: number;
  dayIndex: number;
  label?: string | null;
  location: "home" | "park" | "gym";
};

export type TrainingDayInput = {
  week: number;
  dayIndex: number;
  label?: string | null;
};

export type WorkoutExerciseInput = {
  exerciseId: number;
  sortOrder?: number;
  sets?: number;
  reps?: string;
  restSeconds?: number;
  notes?: string;
};

export type Sex = "male" | "female" | "other";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Goal =
  | "strength"
  | "hypertrophy"
  | "endurance"
  | "fat_loss"
  | "general_fitness"
  | "mobility";

export type Profile = {
  id: number | null;
  userId: number;
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  experience: Experience | null;
  goals: Goal[];
  daysPerWeek: number | null;
  limitations: string;
  updatedAt: string | null;
};

export type ProfileInput = {
  sex: Sex | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  experience: Experience | null;
  goals: Goal[];
  daysPerWeek: number | null;
  limitations: string;
};

export {
  addWorkoutExercise,
  createExercise,
  createProgram,
  createSession,
  createTrainingDay,
  createWorkout,
  countExerciseUses,
  deleteExercise,
  deleteProgram,
  deleteWorkout,
  followProgram,
  generateProgram,
  getExercise,
  getProgram,
  getWorkout,
  listExercises,
  listPrograms,
  listSessions,
  removeWorkoutExercise,
  updateExercise,
  updateProgram,
  updateWorkout,
  updateWorkoutExercise,
} from "./repo";

import { apiRequest } from "./http";

export async function getProfile() {
  return apiRequest<{ profile: Profile }>("/profile");
}

export async function saveProfile(input: ProfileInput) {
  return apiRequest<{ profile: Profile }>("/profile", {
    method: "PUT",
    body: input,
  });
}
