import { SymbolView } from "expo-symbols";
import { Pressable } from "react-native";

import { useTheme } from "@/theme";

export function PlayButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Start session"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`h-[44px] w-[44px] items-center justify-center rounded-control bg-accent active:opacity-85 ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <SymbolView
        name={{ ios: "play.fill", android: "play_arrow", web: "play_arrow" }}
        size={22}
        tintColor={theme["on-accent"]}
      />
    </Pressable>
  );
}
