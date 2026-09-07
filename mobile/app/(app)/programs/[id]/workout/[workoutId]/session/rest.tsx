import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { AppText } from "@/components/ui/text";
import { playRestEndChime } from "@/lib/rest-chime";
import { formatClock, useWorkoutSession } from "@/lib/workout-session";

export default function SessionRestScreen() {
  const { workout, current, restSeconds, finishRest } = useWorkoutSession();
  const [remaining, setRemaining] = useState(restSeconds);
  const advanced = useRef(false);
  const restFor = useRef(restSeconds);

  function leaveRest() {
    if (advanced.current) return;
    advanced.current = true;
    finishRest();
    router.replace(`/programs/${workout.programId}/workout/${workout.id}/session`);
  }

  async function onTimerEnd() {
    if (advanced.current) return;
    advanced.current = true;
    await playRestEndChime();
    finishRest();
    router.replace(`/programs/${workout.programId}/workout/${workout.id}/session`);
  }

  useEffect(() => {
    const duration = restFor.current;
    if (duration <= 0) {
      onTimerEnd();
      return;
    }

    const started = Date.now();
    const id = setInterval(() => {
      const left = duration - (Date.now() - started) / 1000;
      if (left <= 0) {
        clearInterval(id);
        setRemaining(0);
        onTimerEnd();
        return;
      }
      setRemaining(left);
    }, 250);

    return () => clearInterval(id);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-1 justify-between px-5 py-8">
        <View className="gap-2">
          <AppText variant="small" tone="muted">
            Pause
          </AppText>
          <AppText variant="heading">Rest</AppText>
        </View>

        <View className="items-center gap-3">
          <AppText
            variant="display"
            className="font-display-bold text-[96px] leading-[100px] text-accent"
          >
            {formatClock(remaining)}
          </AppText>
        </View>

        <View className="gap-5">
          <View className="gap-1">
            <AppText variant="small" tone="muted">
              Next
            </AppText>
            <AppText variant="title">{current.name}</AppText>
            <AppText variant="body" tone="muted">
              Set {current.setIndex} of {current.setCount} · {current.reps} reps
            </AppText>
          </View>
          <Button title="Skip rest" variant="secondary" onPress={leaveRest} />
        </View>
      </View>
    </SafeAreaView>
  );
}
