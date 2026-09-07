import type { Session } from "./api";

/** Local calendar day as YYYY-MM-DD. */
export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function sessionDayKey(session: Session) {
  const stamp = session.endedAt || session.startedAt;
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return dateKey(new Date());
  return dateKey(date);
}

export function sessionsOnDay(sessions: Session[], day: string | Date) {
  const key = typeof day === "string" ? day : dateKey(day);
  return sessions.filter((session) => sessionDayKey(session) === key);
}

export function sessionDaySet(sessions: Session[]) {
  return new Set(sessions.map(sessionDayKey));
}

export function formatMonthTitle(date: Date) {
  return date.toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function formatDayTitle(date: Date) {
  return date.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function sameDay(a: Date, b: Date) {
  return dateKey(a) === dateKey(b);
}

export function trainingDayKey(week: number, dayIndex: number) {
  return `${week}-${dayIndex}`;
}

/** Training days in a program that already have a finished session. */
export function completedTrainingDayKeys(
  sessions: Session[],
  programId: number,
  workoutIds: Iterable<number> = [],
) {
  const workouts = new Set(workoutIds);
  const keys = new Set<string>();
  for (const session of sessions) {
    const belongs =
      session.programId === programId ||
      (session.workoutId != null && workouts.has(session.workoutId));
    if (!belongs) continue;
    keys.add(trainingDayKey(session.week, session.dayIndex));
  }
  return keys;
}
