import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AppText } from "@/components/ui/text";
import { getWorkout, type Workout } from "@/lib/api";
import { WorkoutSessionProvider } from "@/lib/workout-session";
import { fonts, useTheme } from "@/theme";

export default function SessionLayout() {
  const theme = useTheme();
  const { id, workoutId: workoutIdParam } = useLocalSearchParams<{
    id: string;
    workoutId: string;
  }>();
  const programId = Number(id);
  const workoutId = Number(workoutIdParam);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(programId) || !Number.isInteger(workoutId)) {
      setError("Invalid workout");
      return;
    }

    try {
      const data = await getWorkout(programId, workoutId);
      if (data.workout.exercises.length === 0) {
        setError("This workout has no exercises yet.");
        return;
      }
      setWorkout(data.workout);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    }
  }, [programId, workoutId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-canvas px-5">
        <AppText variant="heading" tone="muted">
          {error}
        </AppText>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  if (!workout) {
    return <LoadingScreen />;
  }

  return (
    <WorkoutSessionProvider workout={workout}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.canvas },
          headerShadowVisible: false,
          headerTintColor: theme.accent,
          headerTitleStyle: {
            fontFamily: fonts.display,
            fontSize: 22,
            color: theme.ink,
          },
          contentStyle: { backgroundColor: theme.canvas },
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" options={{ title: "Session" }} />
        <Stack.Screen name="rest" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="complete" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </WorkoutSessionProvider>
  );
}

