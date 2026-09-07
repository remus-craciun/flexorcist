import { ActivityIndicator, View } from "react-native";

import { useTheme } from "@/theme";

export function LoadingScreen() {
  const theme = useTheme();
  return (
    <View className="flex-1 items-center justify-center bg-canvas">
      <ActivityIndicator size="large" color={theme.accent} />
    </View>
  );
}
