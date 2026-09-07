import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { KeyboardSafeScreen } from "@/components/keyboard-safe-screen";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { OptionGroup } from "@/components/ui/option-group";
import { AppText } from "@/components/ui/text";
import { createProgram, type ProgramStatus } from "@/lib/api";

const WEEK_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
] as const;

const STATUS_OPTIONS: { value: ProgramStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Following" },
  { value: "archived", label: "Archived" },
];

export default function NewProgramScreen() {
  const [title, setTitle] = useState("");
  const [weeks, setWeeks] = useState("4");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ProgramStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { program } = await createProgram({
        title: title.trim(),
        weeks: Number(weeks),
        notes: notes.trim(),
        status,
      });
      router.replace(`/programs/${program.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create program");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardSafeScreen contentClassName="grow gap-6 px-5 py-6">
      <AppText variant="small" tone="muted">
        Programs are max 4 weeks. Training days will each get home, park, and gym workouts.
      </AppText>

      <View className="gap-5">
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Base strength block"
          returnKeyType="next"
        />

        <OptionGroup
          label="Weeks"
          options={[...WEEK_OPTIONS]}
          value={weeks}
          onChange={setWeeks}
        />

        <OptionGroup
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          hint="Home uses the program you’re following. Only one can be followed at a time."
        />

        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes for this block"
          multiline
          textAlignVertical="top"
          className="min-h-[96px] py-3"
        />
      </View>

      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}

      <View className="gap-3">
        <Button
          title="Create program"
          onPress={onCreate}
          loading={saving}
          disabled={!title.trim()}
        />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </KeyboardSafeScreen>
  );
}
