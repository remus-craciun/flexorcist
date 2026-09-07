import { View } from "react-native";

import { LOCATIONS, locationLabels, type Location } from "@/theme";
import { AppText } from "./text";

const dotColor: Record<Location, string> = {
  home: "bg-home",
  park: "bg-park",
  gym: "bg-gym",
};

/**
 * The Flexorcist signature: three swatches for the three workout variants
 * every training day carries — home, park, gym. Used as a compact mark on
 * cards and as a wide bar under the wordmark.
 */
export function LocationMark({
  size = "sm",
  labels = false,
}: {
  size?: "sm" | "bar";
  labels?: boolean;
}) {
  if (size === "bar") {
    return (
      <View className="flex-row gap-1.5">
        {LOCATIONS.map((loc) => (
          <View key={loc} className={`h-1.5 flex-1 rounded-full ${dotColor[loc]}`} />
        ))}
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-3">
      {LOCATIONS.map((loc) => (
        <View key={loc} className="flex-row items-center gap-1.5">
          <View className={`h-2 w-2 rounded-full ${dotColor[loc]}`} />
          {labels ? (
            <AppText variant="caption" tone="muted">
              {locationLabels[loc]}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}
