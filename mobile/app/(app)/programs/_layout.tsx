import { Stack } from "expo-router";

import { fonts, useTheme } from "@/theme";

export default function ProgramsLayout() {
  const theme = useTheme();

  return (
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
      }}
    >
      <Stack.Screen name="index" options={{ title: "Programs", headerShown: false }} />
      <Stack.Screen name="new" options={{ title: "New program", presentation: "modal" }} />
      <Stack.Screen name="generate" options={{ title: "Generate with AI", presentation: "modal" }} />
      <Stack.Screen name="[id]/index" options={{ title: "Program" }} />
      <Stack.Screen name="[id]/edit" options={{ title: "Edit program", presentation: "modal" }} />
      <Stack.Screen name="[id]/add-day" options={{ title: "Add training day", presentation: "modal" }} />
      <Stack.Screen name="[id]/week/[week]/day/[dayIndex]/index" options={{ title: "Workout" }} />
      <Stack.Screen name="[id]/workout/[workoutId]/index" options={{ title: "Workout" }} />
      <Stack.Screen
        name="[id]/workout/[workoutId]/session"
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="[id]/workout/[workoutId]/edit"
        options={{ title: "Edit workout", presentation: "modal" }}
      />
      <Stack.Screen
        name="[id]/workout/[workoutId]/add-exercise"
        options={{ title: "Add exercise", presentation: "modal" }}
      />
    </Stack>
  );
}
