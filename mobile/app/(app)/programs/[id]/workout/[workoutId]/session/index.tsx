import { router, Stack } from "expo-router";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { AppText } from "@/components/ui/text";
import { confirmAction } from "@/lib/confirm";
import { sessionTitle, useWorkoutSession } from "@/lib/workout-session";

export default function SessionExerciseScreen() {
  const { workout, current, steps, currentIndex, markSetDone } = useWorkoutSession();

  async function onLeave() {
    const ok = await confirmAction({
      title: "End session?",
      message: "Progress in this session will be lost.",
      confirmLabel: "End",
      destructive: true,
    });
    if (ok) router.back();
  }

  function onDone() {
    const next = markSetDone();
    if (next === "complete") {
      router.replace(`/programs/${workout.programId}/workout/${workout.id}/session/complete`);
      return;
    }
    if (next === "rest") {
      router.replace(`/programs/${workout.programId}/workout/${workout.id}/session/rest`);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: sessionTitle(workout),
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={onLeave}
              accessibilityRole="button"
              className="px-1 py-1 active:opacity-70"
            >
              <AppText variant="bodyMedium" tone="accent">
                Close
              </AppText>
            </Pressable>
          ),
        }}
      />
      <SafeAreaView className="flex-1 bg-canvas" edges={["bottom", "left", "right"]}>
        <View className="flex-1 justify-between px-5 pb-6 pt-4">
          <View className="gap-2">
            <AppText variant="small" tone="muted">
              Set {current.setIndex} of {current.setCount} · {currentIndex + 1} / {steps.length}
            </AppText>
            <AppText variant="display">{current.name}</AppText>
            {current.muscles.length > 0 ? (
              <AppText variant="small" tone="muted">
                {current.muscles.join(", ")}
              </AppText>
            ) : null}
          </View>

          <View className="items-center gap-2 py-8">
            <AppText
              variant="display"
              className="text-center font-display-bold text-[84px] leading-[88px]"
            >
              {current.reps}
            </AppText>
            <AppText variant="heading" tone="muted">
              reps
            </AppText>
          </View>

          <View className="gap-4">
            {current.notes || current.description ? (
              <AppText variant="body" tone="muted">
                {current.notes || current.description}
              </AppText>
            ) : null}
            <Button title="Done" onPress={onDone} />
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}
