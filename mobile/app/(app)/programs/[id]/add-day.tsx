import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { KeyboardSafeScreen } from "@/components/keyboard-safe-screen";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { OptionGroup } from "@/components/ui/option-group";
import { AppText } from "@/components/ui/text";
import { createTrainingDay, getProgram } from "@/lib/api";
import { WEEKDAYS } from "@/lib/program-days";

export default function AddTrainingDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = Number(id);

  const [maxWeeks, setMaxWeeks] = useState(4);
  const [week, setWeek] = useState("1");
  const [dayIndex, setDayIndex] = useState("1");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProgram(programId)
      .then(({ program }) => {
        setMaxWeeks(program.weeks);
        setWeek("1");
      })
      .catch(() => undefined);
  }, [programId]);

  const weekOptions = Array.from({ length: maxWeeks }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));

  const dayOptions = WEEKDAYS.map((label, i) => ({
    value: String(i + 1),
    label,
  }));

  async function onCreate() {
    setSaving(true);
    setError(null);
    try {
      await createTrainingDay(programId, {
        week: Number(week),
        dayIndex: Number(dayIndex),
        label: label.trim() || null,
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add training day");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardSafeScreen contentClassName="grow gap-6 px-5 py-6">
      <AppText variant="small" tone="muted">
        Creates three workouts for this day — home, park, and gym — ready for exercises.
      </AppText>

      <View className="gap-5">
        <OptionGroup label="Week" options={weekOptions} value={week} onChange={setWeek} />
        <OptionGroup
          label="Day"
          options={dayOptions}
          value={dayIndex}
          onChange={setDayIndex}
        />
        <Field
          label="Workout name"
          value={label}
          onChangeText={setLabel}
          placeholder="Push, Pull, Legs…"
        />
      </View>

      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}

      <View className="gap-3">
        <Button title="Add training day" onPress={onCreate} loading={saving} />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </KeyboardSafeScreen>
  );
}
