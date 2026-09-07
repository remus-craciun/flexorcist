import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { PlayButton } from "@/components/play-button";
import { AppText } from "@/components/ui/text";
import {
  deleteWorkout,
  getWorkout,
  type Workout,
} from "@/lib/api";
import { confirmAction } from "@/lib/confirm";
import { weekdayName } from "@/lib/program-days";
import { locationLabels, type Location } from "@/theme";

export default function WorkoutDetailScreen() {
  const { id, workoutId: workoutIdParam } = useLocalSearchParams<{
    id: string;
    workoutId: string;
  }>();
  const programId = Number(id);
  const workoutId = Number(workoutIdParam);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(programId) || !Number.isInteger(workoutId)) {
      setError("Invalid workout");
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const data = await getWorkout(programId, workoutId);
      setWorkout(data.workout);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workout");
      setWorkout(null);
    } finally {
      setLoading(false);
    }
  }, [programId, workoutId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onDeleteWorkout() {
    if (!workout) return;
    const ok = await confirmAction({
      title: "Delete workout?",
      message: `Delete the ${locationLabels[workout.location as Location]} workout for ${weekdayName(workout.dayIndex)} in week ${workout.week}?`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      await deleteWorkout(programId, workoutId);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete workout");
      setBusy(false);
    }
  }

  if (loading && !workout) {
    return <LoadingScreen />;
  }

  if (!workout) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-canvas px-5">
        <AppText variant="heading" tone="muted">
          {error || "Workout not found"}
        </AppText>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const title = workout.label?.trim()
    ? `${weekdayName(workout.dayIndex)} ${workout.label.trim()}`
    : `${weekdayName(workout.dayIndex)} ${locationLabels[workout.location as Location]}`;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerClassName="gap-5 px-5 pb-10 pt-2"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Card className="gap-3">
          <View className="flex-row flex-wrap items-center gap-2">
            <Chip label={locationLabels[workout.location as Location]} tone={workout.location} />
            <AppText variant="small" tone="muted">
              Week {workout.week} · {weekdayName(workout.dayIndex)}
            </AppText>
          </View>
          {workout.label ? (
            <AppText variant="bodyMedium">{workout.label}</AppText>
          ) : null}
        </Card>

        <View className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <AppText variant="heading">Exercises</AppText>
            <View className="flex-row items-center gap-2">
              <PlayButton
                disabled={workout.exercises.length === 0}
                onPress={() =>
                  router.push(`/programs/${programId}/workout/${workoutId}/session`)
                }
              />
              <Button
                title="Edit"
                size="md"
                variant="secondary"
                onPress={() =>
                  router.push(`/programs/${programId}/workout/${workoutId}/edit`)
                }
              />
            </View>
          </View>

          {workout.exercises.length === 0 ? (
            <Card>
              <AppText variant="small" tone="muted">
                No exercises in this workout yet.
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
          title="Delete workout"
          variant="danger"
          onPress={onDeleteWorkout}
          loading={busy}
        />
      </ScrollView>
    </>
  );
}
