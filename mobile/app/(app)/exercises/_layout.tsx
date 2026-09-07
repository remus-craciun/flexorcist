import { Stack } from "expo-router";

import { fonts, useTheme } from "@/theme";

export default function ExercisesLayout() {
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
      <Stack.Screen name="index" options={{ title: "Exercises", headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Edit exercise", presentation: "modal" }} />
    </Stack>
  );
}
