import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppText } from "@/components/ui/text";
import {
  formatDuration,
  sessionTitle,
  useWorkoutSession,
} from "@/lib/workout-session";
import { useTheme } from "@/theme";

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card className="flex-1 items-center gap-2 py-5">
      {icon}
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </Card>
  );
}

export default function SessionCompleteScreen() {
  const theme = useTheme();
  const { workout, steps, startedAt, endedAt, finishSession, persistFinished } = useWorkoutSession();
  const [saveError, setSaveError] = useState<string | null>(null);
  const elapsed = formatDuration((endedAt ?? Date.now()) - startedAt);
  const exerciseCount = useMemo(
    () => new Set(steps.map((step) => step.itemId)).size,
    [steps],
  );

  useEffect(() => {
    finishSession();
    persistFinished().catch((err) => {
      setSaveError(err instanceof Error ? err.message : "Could not save this session");
    });
  }, [finishSession, persistFinished]);

  async function onClose() {
    try {
      await persistFinished();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save this session");
      return;
    }
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }
    router.replace(`/programs/${workout.programId}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1 justify-between px-5 py-8">
        <View className="items-center gap-4 pt-6">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-accent-soft">
            <SymbolView
              name={{ ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" }}
              size={44}
              tintColor={theme.accent}
            />
          </View>
          <AppText variant="display" className="text-center">
            Session in the book
          </AppText>
          <AppText variant="body" tone="muted" className="text-center">
            {sessionTitle(workout)} is done. That work counts.
          </AppText>
        </View>

        <View className="gap-3">
          <View className="flex-row gap-3">
            <Stat
              icon={
                <SymbolView
                  name={{ ios: "timer", android: "timer", web: "timer" }}
                  size={28}
                  tintColor={theme.accent}
                />
              }
              label="Total time"
              value={elapsed}
            />
            <Stat
              icon={
                <SymbolView
                  name={{ ios: "dumbbell", android: "fitness_center", web: "fitness_center" }}
                  size={28}
                  tintColor={theme.accent}
                />
              }
              label="Exercises"
              value={String(exerciseCount)}
            />
          </View>
          <View className="flex-row gap-3">
            <Stat
              icon={
                <SymbolView
                  name={{ ios: "square.stack.fill", android: "layers", web: "layers" }}
                  size={28}
                  tintColor={theme.accent}
                />
              }
              label="Working sets"
              value={String(steps.length)}
            />
            <Stat
              icon={
                <SymbolView
                  name={{ ios: "calendar", android: "calendar_month", web: "calendar_month" }}
                  size={28}
                  tintColor={theme.accent}
                />
              }
              label="Week"
              value={String(workout.week)}
            />
          </View>
        </View>

        <View className="gap-3">
          {saveError ? (
            <AppText variant="small" tone="danger" className="text-center">
              {saveError}
            </AppText>
          ) : null}
          <Button title="Finish" onPress={onClose} />
        </View>
      </View>
    </SafeAreaView>
  );
}

