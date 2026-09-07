import type { Workout } from "./api";

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export function weekdayName(dayIndex: number): string {
  return WEEKDAYS[dayIndex - 1] ?? `Day ${dayIndex}`;
}

export type TrainingDay = {
  key: string;
  week: number;
  dayIndex: number;
  weekday: string;
  name: string;
  workouts: Workout[];
};

export type WeekGroup = {
  week: number;
  days: TrainingDay[];
};

function dayName(workouts: Workout[]): string {
  const labeled = workouts.find((workout) => workout.label?.trim());
  return labeled?.label?.trim() || "Workout";
}

export function groupTrainingDays(workouts: Workout[]): TrainingDay[] {
  const map = new Map<string, Workout[]>();
  for (const workout of workouts) {
    const key = `${workout.week}-${workout.dayIndex}`;
    const existing = map.get(key);
    if (existing) existing.push(workout);
    else map.set(key, [workout]);
  }

  return [...map.entries()]
    .map(([key, dayWorkouts]) => {
      const first = dayWorkouts[0];
      return {
        key,
        week: first.week,
        dayIndex: first.dayIndex,
        weekday: weekdayName(first.dayIndex),
        name: dayName(dayWorkouts),
        workouts: dayWorkouts,
      };
    })
    .sort((a, b) => a.week - b.week || a.dayIndex - b.dayIndex);
}

export function groupWeeks(workouts: Workout[], weekCount: number): WeekGroup[] {
  const days = groupTrainingDays(workouts);
  return Array.from({ length: Math.max(weekCount, 0) }, (_, index) => {
    const week = index + 1;
    return { week, days: days.filter((day) => day.week === week) };
  });
}

export function findTrainingDay(
  workouts: Workout[],
  week: number,
  dayIndex: number,
): TrainingDay | null {
  return (
    groupTrainingDays(workouts).find(
      (day) => day.week === week && day.dayIndex === dayIndex,
    ) ?? null
  );
}

/** Monday = 1 … Sunday = 7, matching program dayIndex. */
export function calendarDayIndex(date = new Date()): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function currentWeekInProgram(weeks: number, createdAt: string, date = new Date()): number {
  if (weeks < 1) return 1;
  const parsed = new Date(createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return 1;
  const start = Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today - start) / 86_400_000);
  return (Math.floor(Math.max(0, diffDays) / 7) % weeks) + 1;
}
