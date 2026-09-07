import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AppText } from "@/components/ui/text";
import { WorkoutExerciseEditor } from "@/components/workout-exercise-editor";
import { getWorkout, listExercises, type Exercise, type Workout } from "@/lib/api";

export default function EditWorkoutScreen() {
  const { id, workoutId: workoutIdParam } = useLocalSearchParams<{
    id: string;
    workoutId: string;
  }>();
  const programId = Number(id);
  const workoutId = Number(workoutIdParam);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(programId) || !Number.isInteger(workoutId)) {
      setError("Invalid workout");
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const [workoutData, catalogData] = await Promise.all([
        getWorkout(programId, workoutId),
        listExercises(),
      ]);
      setWorkout(workoutData.workout);
      setCatalog(catalogData.exercises);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workout");
      setWorkout(null);
    } finally {
      setLoading(false);
    }
  }, [programId, workoutId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!workout) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-canvas px-5">
        <AppText variant="heading" tone="muted">
          {error || "Workout not found"}
        </AppText>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <WorkoutExerciseEditor
      programId={programId}
      workoutId={workoutId}
      initialItems={workout.exercises}
      catalog={catalog}
      onCancel={() => router.back()}
      onSaved={() => router.back()}
    />
  );
}
