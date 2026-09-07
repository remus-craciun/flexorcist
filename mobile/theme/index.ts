import { useColorScheme } from "react-native";

import { fonts, palette, radius, type ColorToken, type Palette } from "./tokens";

export { fonts, palette, radius };
export type { ColorToken, Palette };

/** Workout location keys, in the order they are always displayed. */
export const LOCATIONS = ["home", "park", "gym"] as const;
export type Location = (typeof LOCATIONS)[number];

export const locationLabels: Record<Location, string> = {
  home: "Home",
  park: "Park",
  gym: "Gym",
};

/**
 * Resolved palette for the current appearance.
 * Use only where a className cannot reach: navigation options,
 * placeholderTextColor, ActivityIndicator, icon tints.
 */
export function useTheme(): Palette {
  const scheme = useColorScheme();
  return scheme === "dark" ? palette.dark : palette.light;
}
