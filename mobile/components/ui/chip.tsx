import { View } from "react-native";

import { AppText } from "./text";

const tones = {
  neutral: { container: "bg-canvas border-line", text: "text-muted" },
  accent: { container: "bg-accent-soft border-accent-soft", text: "text-accent" },
  danger: { container: "bg-danger-soft border-danger-soft", text: "text-danger" },
  done: { container: "bg-done-soft border-done-soft", text: "text-done" },
  home: { container: "bg-home-soft border-home-soft", text: "text-home" },
  park: { container: "bg-park-soft border-park-soft", text: "text-park" },
  gym: { container: "bg-gym-soft border-gym-soft", text: "text-gym" },
} as const;

export type ChipTone = keyof typeof tones;

export function Chip({ label, tone = "neutral" }: { label: string; tone?: ChipTone }) {
  const styles = tones[tone];
  return (
    <View className={`rounded-full border px-2.5 py-1 ${styles.container}`}>
      <AppText variant="caption" className={styles.text}>
        {label}
      </AppText>
    </View>
  );
}
