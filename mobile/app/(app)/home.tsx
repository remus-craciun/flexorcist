import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PlayButton } from "@/components/play-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AppText } from "@/components/ui/text";
import {
  followProgram,
  getProgram,
  listPrograms,
  listSessions,
  type Program,
  type ProgramDetail,
  type Session,
  type Workout,
} from "@/lib/api";
import {
  calendarDayIndex,
  currentWeekInProgram,
  findTrainingDay,
  weekdayName,
} from "@/lib/program-days";
import { dateKey, sessionsOnDay } from "@/lib/session-days";
import { getPreferredPlace, setPreferredPlace } from "@/lib/storage";
import { formatDuration, sessionTitle } from "@/lib/workout-session";
import { LOCATIONS, locationLabels, type Location } from "@/theme";

function placeLabel(place: Location) {
  return place === "park" ? "Workout park" : locationLabels[place];
}

function pickProgram(programs: Program[], preferredId?: number | null): Program | null {
  const followable = programs.filter((program) => program.status !== "archived");
  const pool = followable.length > 0 ? followable : programs;
  const active = pool.find((program) => program.status === "active");
  if (active) return active;
  if (preferredId != null) {
    const preferred = pool.find((program) => program.id === preferredId);
    if (preferred) return preferred;
  }
  return pool.find((program) => program.status === "draft") ?? pool[0] ?? null;
}

const CHEERS = [
  { emoji: "💪 🔥", title: "You crushed it", body: "Session in the book. That work counts." },
  { emoji: "✅ 🏋️", title: "Work complete", body: "You showed up. That's the whole game." },
  { emoji: "👏 💚", title: "Logged and done", body: "The iron noticed. Rest up." },
] as const;

function cheerFor(session: Session) {
  return CHEERS[Math.abs(session.id) % CHEERS.length];
}

function completedSession(today: Session[], place: Location, workout?: Workout) {
  if (workout) {
    const byId = today.find((session) => session.workoutId === workout.id);
    if (byId) return byId;
  }
  return today.find((session) => session.location === place);
}

export default function HomeScreen() {
  const [place, setPlace] = useState<Location>("gym");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const followedIdRef = useRef<number | null>(null);

  const load = useCallback(async (preferredId?: number | null) => {
    setError(null);
    try {
      const stored = await getPreferredPlace();
      if (stored) setPlace(stored);
      const [listed, sessionData] = await Promise.all([listPrograms(), listSessions()]);
      setPrograms(listed.programs);
      setSessions(sessionData.sessions);
      const selected = pickProgram(listed.programs, preferredId ?? followedIdRef.current);
      if (!selected) {
        followedIdRef.current = null;
        setProgram(null);
        return;
      }
      followedIdRef.current = selected.id;
      const detail = await getProgram(selected.id);
      setProgram(detail.program);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load today’s workout");
      setProgram(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const now = new Date();
  const dayIndex = calendarDayIndex(now);
  const weekday = weekdayName(dayIndex);
  const week = program ? currentWeekInProgram(program.weeks, program.createdAt, now) : 1;
  const day = program ? findTrainingDay(program.workouts, week, dayIndex) : null;
  const workout: Workout | undefined = day?.workouts.find((item) => item.location === place);
  const todayLogs = sessionsOnDay(sessions, now);
  const completed = completedSession(todayLogs, place, workout);
  const trainedElsewhere = todayLogs.filter((session) => session.location !== place);
  const cheer = completed ? cheerFor(completed) : null;
  const followable = programs.filter((item) => item.status !== "archived");

  function onSelectPlace(next: Location) {
    setPlace(next);
    void setPreferredPlace(next);
  }

  async function onFollow(id: number) {
    if (program?.id === id || switching) return;
    setSwitching(true);
    setError(null);
    try {
      await followProgram(id);
      followedIdRef.current = id;
      await load(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch program");
    } finally {
      setSwitching(false);
    }
  }

  if (loading && !program) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top", "left", "right"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-10 pt-2"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-1">
          <AppText variant="display">Today</AppText>
          <AppText variant="heading" tone="muted">
            {weekday}
            {program ? ` · Week ${week}` : ""}
          </AppText>
        </View>

        {error ? (
          <AppText variant="small" tone="danger">
            {error}
          </AppText>
        ) : null}

        <View className="gap-2">
          <AppText variant="label">Where are you training?</AppText>
          <View className="flex-row gap-2">
            {LOCATIONS.map((value) => {
              const selected = place === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => onSelectPlace(value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`flex-1 items-center rounded-card border px-3 py-3 ${
                    selected ? "border-accent bg-accent-soft" : "border-line bg-surface"
                  } active:opacity-80`}
                >
                  <AppText
                    variant="label"
                    className={selected ? "text-accent" : "text-ink"}
                  >
                    {placeLabel(value)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {followable.length > 1 ? (
          <View className="gap-2">
            <AppText variant="label">Which program are you following?</AppText>
            <View className="gap-2">
              {followable.map((item) => {
                const selected = program?.id === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => onFollow(item.id)}
                    disabled={switching}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: switching }}
                    className={`rounded-card border px-4 py-3 ${
                      selected ? "border-accent bg-accent-soft" : "border-line bg-surface"
                    } ${switching ? "opacity-70" : "active:opacity-80"}`}
                  >
                    <View className="flex-row items-baseline justify-between gap-3">
                      <AppText
                        variant="bodyMedium"
                        className={`flex-1 ${selected ? "text-accent" : "text-ink"}`}
                      >
                        {item.title}
                      </AppText>
                      <AppText variant="caption" tone={selected ? "accent" : "muted"}>
                        {item.weeks} week{item.weeks === 1 ? "" : "s"}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {trainedElsewhere.length > 0 && !completed ? (
          <Card className="border-done bg-done-soft">
            <AppText variant="bodyMedium" tone="done">
              ✅ Already trained today at{" "}
              {placeLabel(trainedElsewhere[0].location).toLowerCase()}.
            </AppText>
          </Card>
        ) : null}

        {completed && cheer ? (
          <View className="gap-3">
            <Card className="gap-3 border-done bg-done-soft">
              <AppText className="text-[34px] leading-[40px]">{cheer.emoji}</AppText>
              <Chip label="Done today" tone="done" />
              <AppText variant="title" tone="done">
                {cheer.title}
              </AppText>
              <AppText variant="body">{cheer.body}</AppText>
              <AppText variant="heading" tone="done">
                {sessionTitle(completed)}
              </AppText>
              <AppText variant="small">
                {formatDuration(completed.durationMs)} · {placeLabel(completed.location)}
              </AppText>
            </Card>
            <View className="flex-row gap-2">
              <Button
                title="See today"
                onPress={() => router.push(`/history?date=${dateKey(now)}`)}
              />
              {workout ? (
                <Button
                  title="Train again"
                  variant="secondary"
                  onPress={() =>
                    router.push(`/programs/${program?.id}/workout/${workout.id}/session`)
                  }
                />
              ) : null}
            </View>
          </View>
        ) : !program ? (
          <EmptyState
            title="No program yet"
            hint="Generate or create a program, then today’s session will show up here."
            action={
              <View className="flex-row gap-2">
                <Button title="Generate" size="md" onPress={() => router.push("/programs/generate")} />
                <Button title="New" size="md" variant="secondary" onPress={() => router.push("/programs/new")} />
              </View>
            }
          />
        ) : !day ? (
          <Card className="gap-3">
            <Chip label={placeLabel(place)} tone={place} />
            <AppText variant="title">Rest day</AppText>
            <AppText variant="body" tone="muted">
              {program.title} has no session on {weekday}.
            </AppText>
            <Button
              title="Open program"
              variant="secondary"
              onPress={() => router.push(`/programs/${program.id}`)}
            />
          </Card>
        ) : !workout ? (
          <Card className="gap-3">
            <Chip label={placeLabel(place)} tone={place} />
            <AppText variant="title">{day.name}</AppText>
            <AppText variant="body" tone="muted">
              No {placeLabel(place).toLowerCase()} version of today’s session yet.
            </AppText>
            <Button
              title="Open day"
              variant="secondary"
              onPress={() => router.push(`/programs/${program.id}/week/${week}/day/${dayIndex}`)}
            />
          </Card>
        ) : (
          <View className="gap-3">
            <Card className="gap-3">
              <View className="flex-row flex-wrap items-center gap-2">
                <Chip label={placeLabel(place)} tone={place} />
                <AppText variant="small" tone="muted">
                  {program.title}
                </AppText>
              </View>
              <AppText variant="title">{day.name}</AppText>
              <AppText variant="small" tone="muted">
                {workout.exercises.length} exercise
                {workout.exercises.length === 1 ? "" : "s"}
              </AppText>
            </Card>

            <View className="flex-row items-center justify-between gap-3">
              <AppText variant="heading">Session</AppText>
              <View className="flex-row items-center gap-2">
                <PlayButton
                  disabled={workout.exercises.length === 0}
                  onPress={() =>
                    router.push(`/programs/${program.id}/workout/${workout.id}/session`)
                  }
                />
                <Button
                  title="Open"
                  size="md"
                  variant="secondary"
                  onPress={() =>
                    router.push(`/programs/${program.id}/week/${week}/day/${dayIndex}`)
                  }
                />
              </View>
            </View>

            {workout.exercises.length === 0 ? (
              <Card>
                <AppText variant="small" tone="muted">
                  No exercises in the {placeLabel(place).toLowerCase()} workout yet.
                </AppText>
              </Card>
            ) : (
              workout.exercises.map((item) => (
                <Card key={item.id} className="gap-1">
                  <AppText variant="bodyMedium">{item.exercise.name}</AppText>
                  <AppText variant="small" tone="muted">
                    {item.sets} sets · {item.reps} reps
                  </AppText>
                </Card>
              ))
            )}
          </View>
        )}

        {sessions.length > 0 ? (
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <AppText variant="heading">Recent</AppText>
              <Button title="History" size="md" variant="ghost" onPress={() => router.push("/history")} />
            </View>
            {sessions.slice(0, 3).map((item) => (
              <Pressable
                key={item.id}
                onPress={() =>
                  router.push(
                    `/history?date=${dateKey(new Date(item.endedAt || item.startedAt))}`,
                  )
                }
                accessibilityRole="button"
                className="active:opacity-90"
              >
                <Card className="gap-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Chip label={placeLabel(item.location)} tone={item.location} />
                    <Chip label="Done" tone="done" />
                    <AppText variant="small" tone="muted">
                      {item.programTitle || "Program"}
                    </AppText>
                  </View>
                  <AppText variant="bodyMedium">{sessionTitle(item)}</AppText>
                  <AppText variant="small" tone="muted">
                    {formatDuration(item.durationMs)}
                  </AppText>
                </Card>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
