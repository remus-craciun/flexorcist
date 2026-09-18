import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  css,
  cubicBezier,
  useReducedMotion,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/text";
import { WEEKDAY_OPTIONS } from "@/lib/program-days";
import { LOCATIONS, useTheme } from "@/theme";

const EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);

/** One full home → park → gym pass per cell. */
const CELL_CYCLE_MS = 3600;
/** How far behind each cell trails the one before it, in reading order. */
const CELL_STAGGER_MS = 110;
/** Bars light up one after another at this spacing. */
const BAR_PULSE_MS = 1500;

/** Hold time per status line. Sized to feel unhurried, not to match the model. */
const STATUS_HOLD_MS = 3200;

function statusLines(weeks: number, dayCount: number): string[] {
  const week = weeks === 1 ? "week" : "weeks";
  const day = dayCount === 1 ? "day" : "days";
  return [
    "Reading your profile",
    `Laying out ${dayCount} training ${day} a week`,
    `Balancing sets across ${weeks} ${week}`,
    "Writing a home version of every workout",
    "Writing the park version",
    "Writing the gym version",
    "Saving new movements to your library",
    "Still writing — a thorough program takes a moment",
  ];
}

export type ProgramForgeProps = {
  weeks: number;
  /** Training days as dayIndex values: 1=Monday … 7=Sunday. */
  days: number[];
};

/**
 * Shown while the model builds a program. Draws the week grid the user just
 * chose and "writes" each training day in the three location colours, on
 * the UI thread, for as long as the request takes.
 */
export function ProgramForge({ weeks, days }: ProgramForgeProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const trainingDays = useMemo(() => new Set(days), [days]);

  const lines = useMemo(
    () => statusLines(weeks, days.length),
    [weeks, days.length],
  );
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setLineIndex((index) => Math.min(index + 1, lines.length - 1));
    }, STATUS_HOLD_MS);
    return () => clearInterval(id);
  }, [lines.length]);

  // Keyframes reference resolved palette colours, so they rebuild on scheme change.
  const cellCycle = useMemo(
    () =>
      css.keyframes({
        // Colour walks home → park → gym; the cell breathes in at the start
        // of each pass and settles for the rest of it.
        "0%": {
          backgroundColor: theme.home,
          transform: [{ scale: reducedMotion ? 1 : 0.86 }],
        },
        "16%": { transform: [{ scale: 1 }] },
        "33%": { backgroundColor: theme.park },
        "66%": { backgroundColor: theme.gym },
        "84%": { transform: [{ scale: 1 }] },
        "100%": {
          backgroundColor: theme.home,
          transform: [{ scale: reducedMotion ? 1 : 0.86 }],
        },
      }),
    [theme, reducedMotion],
  );

  const barPulse = useMemo(
    () =>
      css.keyframes({
        "0%": { opacity: 0.25 },
        "30%": { opacity: 1 },
        "60%": { opacity: 0.25 },
        "100%": { opacity: 0.25 },
      }),
    [],
  );

  const barColor = {
    home: theme.home,
    park: theme.park,
    gym: theme.gym,
  } as const;

  // NativeWind's interop doesn't cover Animated.View, so animated nodes use
  // plain styles; static layout keeps className.
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <Animated.View entering={FadeIn.duration(220)} style={styles.screen}>
        <View className="w-full gap-3">
          <View className="flex-row gap-2">
            {WEEKDAY_OPTIONS.map((option) => (
              <View key={option.value} className="flex-1 items-center">
                <AppText
                  variant="caption"
                  tone={
                    trainingDays.has(Number(option.value)) ? "default" : "faint"
                  }
                >
                  {option.label.slice(0, 1)}
                </AppText>
              </View>
            ))}
          </View>

          {Array.from({ length: weeks }, (_, row) => (
            <View key={row} className="flex-row gap-2">
              {WEEKDAY_OPTIONS.map((option, col) => {
                const dayIndex = Number(option.value);
                const isTraining = trainingDays.has(dayIndex);
                if (!isTraining) {
                  return (
                    <View
                      key={option.value}
                      className="bg-line"
                      style={[styles.cell, styles.restCell]}
                    />
                  );
                }
                const order = row * WEEKDAY_OPTIONS.length + col;
                return (
                  <Animated.View
                    key={option.value}
                    style={{
                      ...styles.cell,
                      backgroundColor: theme.home,
                      animationName: cellCycle,
                      animationDuration: `${CELL_CYCLE_MS}ms`,
                      animationDelay: `${order * CELL_STAGGER_MS}ms`,
                      animationIterationCount: "infinite",
                      animationTimingFunction: EASE_IN_OUT,
                      animationFillMode: "both",
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>

        <View className="w-full items-center gap-5">
          <View className="w-32 flex-row gap-1.5">
            {LOCATIONS.map((loc, index) => (
              <Animated.View
                key={loc}
                style={{
                  ...styles.bar,
                  backgroundColor: barColor[loc],
                  opacity: 0.25,
                  animationName: barPulse,
                  animationDuration: `${BAR_PULSE_MS * LOCATIONS.length}ms`,
                  animationDelay: `${index * BAR_PULSE_MS}ms`,
                  animationIterationCount: "infinite",
                  animationTimingFunction: EASE_IN_OUT,
                  animationFillMode: "both",
                }}
              />
            ))}
          </View>

          <View className="items-center gap-2">
            <AppText variant="title">Building your program</AppText>
            <View className="h-10 items-center justify-center">
              <Animated.View
                key={lineIndex}
                entering={FadeIn.duration(260)}
                exiting={FadeOut.duration(180)}
              >
                <AppText variant="small" tone="muted" className="text-center">
                  {lines[lineIndex]}…
                </AppText>
              </Animated.View>
            </View>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 40,
    paddingHorizontal: 32,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
  },
  restCell: {
    opacity: 0.45,
  },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
});
