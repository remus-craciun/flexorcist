import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { KeyboardSafeScreen } from "@/components/keyboard-safe-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AppText } from "@/components/ui/text";
import { addWorkoutExercise, listExercises, type Exercise } from "@/lib/api";

export default function AddExerciseToWorkoutScreen() {
  const { id, workoutId: workoutIdParam } = useLocalSearchParams<{
    id: string;
    workoutId: string;
  }>();
  const programId = Number(id);
  const workoutId = Number(workoutIdParam);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("8-12");
  const [restSeconds, setRestSeconds] = useState("90");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listExercises();
      setExercises(data.exercises);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exercises");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onAdd() {
    if (selectedId == null) {
      setError("Pick an exercise");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await addWorkoutExercise(programId, workoutId, {
        exerciseId: selectedId,
        sets: Number(sets) || 3,
        reps: reps.trim() || "8-12",
        restSeconds: Number(restSeconds) || 90,
        notes: notes.trim(),
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add exercise");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <KeyboardSafeScreen contentClassName="grow gap-6 px-5 py-6">
      <AppText variant="small" tone="muted">
        Choose an exercise from your library, then set volume.
      </AppText>

      <View className="gap-2">
        <AppText variant="label">Exercise</AppText>
        {exercises.length === 0 ? (
          <Card>
            <AppText variant="small" tone="muted">
              No exercises yet. Add some in the Exercises tab first.
            </AppText>
          </Card>
        ) : (
          exercises.map((exercise) => {
            const selected = selectedId === exercise.id;
            return (
              <Pressable
                key={exercise.id}
                onPress={() => setSelectedId(exercise.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`rounded-card border px-4 py-3 ${
                  selected ? "border-accent bg-accent-soft" : "border-line bg-surface"
                }`}
              >
                <AppText variant="bodyMedium">{exercise.name}</AppText>
                {exercise.muscles.length > 0 ? (
                  <AppText variant="caption" tone="muted">
                    {exercise.muscles.join(", ")}
                  </AppText>
                ) : null}
              </Pressable>
            );
          })
        )}
      </View>

      <View className="flex-row gap-3">
        <Field
          containerClassName="flex-1"
          label="Sets"
          keyboardType="number-pad"
          value={sets}
          onChangeText={setSets}
        />
        <Field
          containerClassName="flex-1"
          label="Reps"
          value={reps}
          onChangeText={setReps}
          placeholder="8-12"
        />
        <Field
          containerClassName="flex-1"
          label="Rest (s)"
          keyboardType="number-pad"
          value={restSeconds}
          onChangeText={setRestSeconds}
        />
      </View>

      <Field
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
      />

      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}

      <View className="gap-3">
        <Button
          title="Add to workout"
          onPress={onAdd}
          loading={saving}
          disabled={selectedId == null}
        />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </KeyboardSafeScreen>
  );
}
