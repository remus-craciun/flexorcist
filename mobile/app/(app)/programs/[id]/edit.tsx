import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { KeyboardSafeScreen } from "@/components/keyboard-safe-screen";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { OptionGroup } from "@/components/ui/option-group";
import { AppText } from "@/components/ui/text";
import {
  getProgram,
  updateProgram,
  type ProgramStatus,
} from "@/lib/api";
import { confirmAction } from "@/lib/confirm";

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

export default function EditProgramScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = Number(id);

  const [title, setTitle] = useState("");
  const [weeks, setWeeks] = useState("4");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ProgramStatus>("draft");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(programId)) {
      setError("Invalid program");
      setLoading(false);
      return;
    }

    try {
      const { program } = await getProgram(programId);
      setTitle(program.title);
      setWeeks(String(program.weeks));
      setNotes(program.notes);
      setStatus(program.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load program");
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave() {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    const ok = await confirmAction({
      title: "Save changes?",
      message: "Update this program with the values you entered.",
      confirmLabel: "Save",
    });
    if (!ok) return;

    setSaving(true);
    setError(null);
    try {
      await updateProgram(programId, {
        title: title.trim(),
        weeks: Number(weeks),
        notes: notes.trim(),
        status,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save program");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <KeyboardSafeScreen contentClassName="grow gap-6 px-5 py-6">
      <View className="gap-5">
        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Program title"
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
          placeholder="Optional notes"
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
          title="Save changes"
          onPress={onSave}
          loading={saving}
          disabled={!title.trim()}
        />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </KeyboardSafeScreen>
  );
}
