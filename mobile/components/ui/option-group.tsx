import { Pressable, View } from "react-native";

import { AppText } from "./text";

export type Option<T extends string> = {
  value: T;
  label: string;
};

type OptionGroupProps<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  hint?: string;
};

/** Single-select chip row. */
export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  hint,
}: OptionGroupProps<T>) {
  return (
    <View className="gap-2">
      <AppText variant="label">{label}</AppText>
      {hint ? (
        <AppText variant="caption" tone="faint">
          {hint}
        </AppText>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`rounded-full border px-3.5 py-2 ${
                selected
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface active:bg-canvas"
              }`}
            >
              <AppText
                variant="label"
                className={selected ? "text-accent" : "text-ink"}
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type MultiOptionGroupProps<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  hint?: string;
};

/** Multi-select chip row. */
export function MultiOptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  hint,
}: MultiOptionGroupProps<T>) {
  function toggle(next: T) {
    if (value.includes(next)) {
      onChange(value.filter((item) => item !== next));
    } else {
      onChange([...value, next]);
    }
  }

  return (
    <View className="gap-2">
      <AppText variant="label">{label}</AppText>
      {hint ? (
        <AppText variant="caption" tone="faint">
          {hint}
        </AppText>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => toggle(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`rounded-full border px-3.5 py-2 ${
                selected
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-surface active:bg-canvas"
              }`}
            >
              <AppText
                variant="label"
                className={selected ? "text-accent" : "text-ink"}
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
