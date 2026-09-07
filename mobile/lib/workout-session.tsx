import React, { createContext, useCallback, useMemo, useRef, useState } from "react";

import { createSession, type Workout, type WorkoutExercise } from "./api";
import { weekdayName } from "./program-days";
import { locationLabels, type Location } from "@/theme";

export type SessionStep = {
  itemId: number;
  name: string;
  notes: string;
  muscles: string[];
  description: string;
  setIndex: number;
  setCount: number;
  reps: string;
  restSeconds: number;
};

export function buildSessionSteps(exercises: WorkoutExercise[]): SessionStep[] {
  return exercises.flatMap((item) => {
    const setCount = Math.max(item.sets, 1);
    return Array.from({ length: setCount }, (_, index) => ({
      itemId: item.id,
      name: item.exercise.name,
      notes: item.notes,
      muscles: item.exercise.muscles,
      description: item.exercise.description,
      setIndex: index + 1,
      setCount,
      reps: item.reps,
      restSeconds: item.restSeconds,
    }));
  });
}

export function formatDuration(ms: number) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} min ${seconds}s`;
  return `${seconds}s`;
}

export function formatSessionWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSessionClock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function sessionTitle(workout: {
  dayIndex: number;
  label: string | null;
  location: Location;
}) {
  const label = workout.label?.trim();
  if (label) return `${weekdayName(workout.dayIndex)} ${label}`;
  return `${weekdayName(workout.dayIndex)} ${locationLabels[workout.location]}`;
}

type SessionValue = {
  workout: Workout;
  steps: SessionStep[];
  currentIndex: number;
  current: SessionStep;
  next: SessionStep | null;
  restSeconds: number;
  startedAt: number;
  endedAt: number | null;
  markSetDone: () => "rest" | "exercise" | "complete";
  finishRest: () => void;
  finishSession: () => void;
  persistFinished: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function WorkoutSessionProvider({
  workout,
  children,
}: {
  workout: Workout;
  children: React.ReactNode;
}) {
  const steps = useMemo(() => buildSessionSteps(workout.exercises), [workout.exercises]);
  const startedAtRef = useRef(Date.now());
  const persistedRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);
  const [startedAt] = useState(() => startedAtRef.current);
  const [endedAt, setEndedAt] = useState<number | null>(null);

  const current = steps[Math.min(currentIndex, Math.max(steps.length - 1, 0))] as SessionStep;
  const next = currentIndex + 1 < steps.length ? steps[currentIndex + 1] : null;

  const finishSession = useCallback(() => {
    setEndedAt((existing) => existing ?? Date.now());
  }, []);

  const persistFinished = useCallback(async () => {
    const end = Date.now();
    setEndedAt((existing) => existing ?? end);
    if (persistedRef.current) return;
    persistedRef.current = true;
    try {
      await createSession({
        workoutId: workout.id,
        startedAt: new Date(startedAtRef.current).toISOString(),
        endedAt: new Date(end).toISOString(),
        durationMs: Math.max(0, end - startedAtRef.current),
      });
    } catch (err) {
      persistedRef.current = false;
      throw err;
    }
  }, [workout.id]);

  const markSetDone = useCallback((): "rest" | "exercise" | "complete" => {
    const finished = steps[currentIndex];
    if (!finished || currentIndex >= steps.length - 1) {
      finishSession();
      return "complete";
    }

    setCurrentIndex((index) => index + 1);
    setRestSeconds(finished.restSeconds);
    return finished.restSeconds > 0 ? "rest" : "exercise";
  }, [currentIndex, finishSession, steps]);

  const finishRest = useCallback(() => {
    setRestSeconds(0);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      workout,
      steps,
      currentIndex,
      current,
      next,
      restSeconds,
      startedAt,
      endedAt,
      markSetDone,
      finishRest,
      finishSession,
      persistFinished,
    }),
    [
      workout,
      steps,
      currentIndex,
      current,
      next,
      restSeconds,
      startedAt,
      endedAt,
      markSetDone,
      finishRest,
      finishSession,
      persistFinished,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useWorkoutSession() {
  const value = React.use(SessionContext);
  if (!value) {
    throw new Error("useWorkoutSession must be used inside a session");
  }
  return value;
}
