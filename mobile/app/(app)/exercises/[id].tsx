import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { KeyboardSafeScreen } from "@/components/keyboard-safe-screen";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AppText } from "@/components/ui/text";
import { deleteExercise, getExercise, updateExercise, countExerciseUses } from "@/lib/api";
import { confirmAction } from "@/lib/confirm";

function normalizeMuscles(values: string[]) {
  const seen = new Set<string>();
  const muscles: string[] = [];
  for (const value of values) {
    const muscle = value.trim();
    const key = muscle.toLowerCase();
    if (!muscle || seen.has(key)) continue;
    seen.add(key);
    muscles.push(muscle);
  }
  return muscles;
}

export default function EditExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = Number(id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [muscles, setMuscles] = useState<string[]>([]);
  const [muscleDraft, setMuscleDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(exerciseId)) {
      setError("Invalid exercise");
      setLoading(false);
      return;
    }

    try {
      const { exercise } = await getExercise(exerciseId);
      setName(exercise.name);
      setDescription(exercise.description);
      setMuscles(exercise.muscles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exercise");
    } finally {
      setLoading(false);
    }
  }, [exerciseId]);

  useEffect(() => {
    load();
  }, [load]);

  function addMuscle() {
    const next = normalizeMuscles([...muscles, muscleDraft]);
    setMuscles(next);
    setMuscleDraft("");
  }

  async function onSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateExercise(exerciseId, {
        name: name.trim(),
        muscles: normalizeMuscles([...muscles, muscleDraft]),
        description: description.trim(),
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save exercise");
    } finally {
      setSaving(false);
    }
  }

  async function onRemove() {
    const uses = await countExerciseUses(exerciseId);
    const ok = await confirmAction({
      title: "Remove exercise?",
      message:
        uses > 0
          ? `“${name.trim() || "This exercise"}” is in ${uses} workout${uses === 1 ? "" : "s"}. Removing it will take it out of those sessions. This cannot be undone.`
          : `Remove “${name.trim() || "this exercise"}” from the library? This cannot be undone.`,
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;

    setRemoving(true);
    setError(null);
    try {
      await deleteExercise(exerciseId);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove exercise");
      setRemoving(false);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <KeyboardSafeScreen contentClassName="grow gap-6 px-5 py-6">
      <View className="gap-5">
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Exercise name"
          returnKeyType="next"
        />

        <View className="gap-2">
          <AppText variant="label">Muscles</AppText>
          {muscles.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {muscles.map((muscle) => (
                <Pressable
                  key={muscle}
                  onPress={() => setMuscles(muscles.filter((item) => item !== muscle))}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${muscle}`}
                  className="active:opacity-70"
                >
                  <Chip label={muscle} />
                </Pressable>
              ))}
            </View>
          ) : null}
          <AppText variant="caption" tone="faint">
            {muscles.length > 0 ? "Tap a muscle to remove it." : "Add the muscles this movement trains."}
          </AppText>
          <Field
            value={muscleDraft}
            onChangeText={setMuscleDraft}
            placeholder="Add a muscle"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={addMuscle}
          />
        </View>

        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="How to perform it"
          multiline
          textAlignVertical="top"
          className="min-h-[120px] py-3"
        />
      </View>

      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}

      <View className="gap-3">
        <Button
          title="Save changes"
          onPress={onSave}
          loading={saving}
          disabled={!name.trim() || removing}
        />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} disabled={saving || removing} />
        <Button
          title="Remove exercise"
          variant="danger"
          onPress={onRemove}
          loading={removing}
          disabled={saving}
        />
      </View>
    </KeyboardSafeScreen>
  );
}
