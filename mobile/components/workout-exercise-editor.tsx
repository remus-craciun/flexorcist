import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { KeyboardSafeScreen } from "@/components/keyboard-safe-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { AppText } from "@/components/ui/text";
import {
  addWorkoutExercise,
  removeWorkoutExercise,
  updateWorkoutExercise,
  type Exercise,
  type WorkoutExercise,
} from "@/lib/api";
import { confirmAction } from "@/lib/confirm";

type DraftItem = {
  key: string;
  id: number | null;
  exerciseId: number;
  name: string;
  muscles: string[];
  sets: string;
  reps: string;
};

function toDraft(items: WorkoutExercise[]): DraftItem[] {
  return items.map((item) => ({
    key: `saved-${item.id}`,
    id: item.id,
    exerciseId: item.exerciseId,
    name: item.exercise.name,
    muscles: item.exercise.muscles,
    sets: String(item.sets),
    reps: item.reps,
  }));
}

export function WorkoutExerciseEditor({
  programId,
  workoutId,
  initialItems,
  catalog,
  onCancel,
  onSaved,
}: {
  programId: number;
  workoutId: number;
  initialItems: WorkoutExercise[];
  catalog: Exercise[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState(() => toDraft(initialItems));
  const [pickingFor, setPickingFor] = useState<string | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originalIds = useMemo(
    () => new Set(initialItems.map((item) => item.id)),
    [initialItems],
  );

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  }

  async function removeItem(item: DraftItem) {
    const ok = await confirmAction({
      title: "Remove exercise?",
      message: `Remove “${item.name}” from this workout.`,
      confirmLabel: "Remove",
      destructive: true,
    });
    if (!ok) return;
    setItems((current) => current.filter((row) => row.key !== item.key));
  }

  function applyPick(exercise: Exercise) {
    if (pickingFor === "new") {
      setItems((current) => [
        ...current,
        {
          key: `new-${Date.now()}`,
          id: null,
          exerciseId: exercise.id,
          name: exercise.name,
          muscles: exercise.muscles,
          sets: "3",
          reps: "8-12",
        },
      ]);
    } else if (pickingFor) {
      updateItem(pickingFor, {
        exerciseId: exercise.id,
        name: exercise.name,
        muscles: exercise.muscles,
      });
    }
    setPickingFor(null);
  }

  async function onSave() {
    const parsed: { item: DraftItem; sets: number }[] = [];
    for (const item of items) {
      const sets = Number(item.sets);
      if (!Number.isInteger(sets) || sets < 1) {
        setError(`Sets for ${item.name} must be a whole number of 1 or more.`);
        return;
      }
      if (!item.reps.trim()) {
        setError(`Add reps for ${item.name}.`);
        return;
      }
      parsed.push({ item, sets });
    }

    setSaving(true);
    setError(null);
    try {
      const keptIds = new Set(parsed.flatMap(({ item }) => (item.id == null ? [] : [item.id])));
      for (const id of originalIds) {
        if (!keptIds.has(id)) {
          await removeWorkoutExercise(programId, workoutId, id);
        }
      }

      for (const [index, { item, sets }] of parsed.entries()) {
        const body = {
          exerciseId: item.exerciseId,
          sets,
          reps: item.reps.trim(),
          sortOrder: index,
        };
        if (item.id == null) {
          await addWorkoutExercise(programId, workoutId, body);
        } else {
          await updateWorkoutExercise(programId, workoutId, item.id, body);
        }
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save workout");
    } finally {
      setSaving(false);
    }
  }

  if (pickingFor != null) {
    return (
      <KeyboardSafeScreen contentClassName="grow gap-6 px-5 py-6">
        <View className="gap-1">
          <AppText variant="heading">
            {pickingFor === "new" ? "Add exercise" : "Replace exercise"}
          </AppText>
          <AppText variant="small" tone="muted">
            {pickingFor === "new"
              ? "Pick a movement to add to this workout."
              : "Pick the movement that should take this slot."}
          </AppText>
        </View>

        {catalog.length === 0 ? (
          <Card>
            <AppText variant="small" tone="muted">
              No exercises yet. Add some in the Exercises tab first.
            </AppText>
          </Card>
        ) : (
          <View className="gap-2">
            {catalog.map((exercise) => (
              <Pressable
                key={exercise.id}
                onPress={() => applyPick(exercise)}
                accessibilityRole="button"
                className="rounded-card border border-line bg-surface px-4 py-3 active:bg-canvas"
              >
                <AppText variant="bodyMedium">{exercise.name}</AppText>
                {exercise.muscles.length > 0 ? (
                  <AppText variant="caption" tone="muted">
                    {exercise.muscles.join(", ")}
                  </AppText>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        <Button title="Cancel" variant="ghost" onPress={() => setPickingFor(null)} />
      </KeyboardSafeScreen>
    );
  }

  return (
    <KeyboardSafeScreen contentClassName="grow gap-6 px-5 py-6">
      <AppText variant="small" tone="muted">
        Replace a movement, change sets and reps, or move exercises up and down. Save when you are done.
      </AppText>

      {items.length === 0 ? (
        <Card>
          <AppText variant="small" tone="muted">
            This workout is empty. Add an exercise to start.
          </AppText>
        </Card>
      ) : (
        items.map((item, index) => (
          <Card key={item.key} className="gap-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <AppText variant="caption" tone="faint">
                  {index + 1} of {items.length}
                </AppText>
                <AppText variant="bodyMedium">{item.name}</AppText>
                {item.muscles.length > 0 ? (
                  <AppText variant="caption" tone="muted">
                    {item.muscles.join(", ")}
                  </AppText>
                ) : null}
              </View>
              <Pressable
                onPress={() => setPickingFor(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`Change ${item.name}`}
                className="active:opacity-70"
              >
                <AppText variant="label" tone="accent">
                  Change
                </AppText>
              </Pressable>
            </View>

            <View className="flex-row gap-3">
              <Field
                containerClassName="flex-1"
                label="Sets"
                keyboardType="number-pad"
                value={item.sets}
                onChangeText={(sets) => updateItem(item.key, { sets })}
              />
              <Field
                containerClassName="flex-1"
                label="Reps"
                value={item.reps}
                onChangeText={(reps) => updateItem(item.key, { reps })}
                placeholder="8-12"
              />
            </View>

            <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
              <Pressable
                onPress={() => moveItem(index, -1)}
                disabled={index === 0}
                accessibilityRole="button"
                accessibilityLabel={`Move ${item.name} up`}
                className={`active:opacity-70 ${index === 0 ? "opacity-30" : ""}`}
              >
                <AppText variant="label">Up</AppText>
              </Pressable>
              <Pressable
                onPress={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                accessibilityRole="button"
                accessibilityLabel={`Move ${item.name} down`}
                className={`active:opacity-70 ${index === items.length - 1 ? "opacity-30" : ""}`}
              >
                <AppText variant="label">Down</AppText>
              </Pressable>
              <Pressable
                onPress={() => removeItem(item)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name}`}
                className="active:opacity-70"
              >
                <AppText variant="label" tone="danger">
                  Remove
                </AppText>
              </Pressable>
            </View>
          </Card>
        ))
      )}

      <Button
        title="Add exercise"
        variant="secondary"
        onPress={() => setPickingFor("new")}
      />

      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}

      <View className="gap-3">
        <Button title="Save changes" onPress={onSave} loading={saving} />
        <Button title="Cancel" variant="ghost" onPress={onCancel} disabled={saving} />
      </View>
    </KeyboardSafeScreen>
  );
}
