import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { PlayButton } from "@/components/play-button";
import { AppText } from "@/components/ui/text";
import {
  deleteWorkout,
  getProgram,
  type ProgramDetail,
  type Workout,
} from "@/lib/api";
import { confirmAction } from "@/lib/confirm";
import { findTrainingDay } from "@/lib/program-days";
import { LOCATIONS, locationLabels, type Location } from "@/theme";

export default function TrainingDayScreen() {
  const params = useLocalSearchParams<{
    id: string;
    week: string;
    dayIndex: string;
  }>();
  const programId = Number(params.id);
  const week = Number(params.week);
  const dayIndex = Number(params.dayIndex);

  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [location, setLocation] = useState<Location>("gym");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(programId) || !Number.isInteger(week) || !Number.isInteger(dayIndex)) {
      setError("Invalid training day");
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const data = await getProgram(programId);
      setProgram(data.program);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load training day");
      setProgram(null);
    } finally {
      setLoading(false);
    }
  }, [programId, week, dayIndex]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const day = useMemo(
    () => (program ? findTrainingDay(program.workouts, week, dayIndex) : null),
    [program, week, dayIndex],
  );

  const selectedLocation: Location =
    day?.workouts.some((item) => item.location === location)
      ? location
      : ((day?.workouts[0]?.location as Location | undefined) ?? "gym");
  const workout: Workout | undefined = day?.workouts.find(
    (item) => item.location === selectedLocation,
  );

  async function onDeleteDay() {
    if (!day) return;
    const ok = await confirmAction({
      title: "Remove this day?",
      message: `Remove ${day.weekday} ${day.name} from week ${week}, including home, park, and gym workouts.`,
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      await Promise.all(day.workouts.map((item) => deleteWorkout(programId, item.id)));
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove day");
      setBusy(false);
    }
  }

  if (loading && !program) {
    return <LoadingScreen />;
  }

  if (!day || !workout) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-canvas px-5">
        <AppText variant="heading" tone="muted">
          {error || "Training day not found"}
        </AppText>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const title = `${day.weekday} ${day.name}`;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerClassName="gap-5 px-5 pb-10 pt-2"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Card className="gap-4">
          <View className="gap-1">
            <AppText variant="small" tone="muted">
              Week {week} · {day.weekday}
            </AppText>
            <AppText variant="title">{day.name}</AppText>
          </View>
          <View className="flex-row gap-2">
            {LOCATIONS.map((value) => {
              const exists = day.workouts.some((item) => item.location === value);
              const selected = selectedLocation === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => exists && setLocation(value)}
                  disabled={!exists}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`flex-1 items-center rounded-full border px-3 py-2 ${
                    selected
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-canvas"
                  } ${exists ? "active:opacity-80" : "opacity-40"}`}
                >
                  <AppText
                    variant="label"
                    className={selected ? "text-accent" : "text-ink"}
                  >
                    {locationLabels[value]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <View className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <AppText variant="heading">Exercises</AppText>
            <View className="flex-row items-center gap-2">
              <PlayButton
                disabled={workout.exercises.length === 0}
                onPress={() =>
                  router.push(`/programs/${programId}/workout/${workout.id}/session`)
                }
              />
              <Button
                title="Edit"
                size="md"
                variant="secondary"
                onPress={() =>
                  router.push(`/programs/${programId}/workout/${workout.id}/edit`)
                }
              />
            </View>
          </View>

          {workout.exercises.length === 0 ? (
            <Card>
              <AppText variant="small" tone="muted">
                No exercises for {locationLabels[workout.location]} yet.
              </AppText>
            </Card>
          ) : (
            workout.exercises.map((item) => (
              <Card key={item.id} className="gap-1">
                <AppText variant="bodyMedium">{item.exercise.name}</AppText>
                <AppText variant="small" tone="muted">
                  {item.sets} sets · {item.reps} reps · {item.restSeconds}s rest
                </AppText>
                {item.notes ? (
                  <AppText variant="caption" tone="faint">
                    {item.notes}
                  </AppText>
                ) : null}
              </Card>
            ))
          )}
        </View>

        {error ? (
          <AppText variant="small" tone="danger">
            {error}
          </AppText>
        ) : null}

        <Button
          title="Remove day"
          variant="danger"
          onPress={onDeleteDay}
          loading={busy}
        />
      </ScrollView>
    </>
  );
}
