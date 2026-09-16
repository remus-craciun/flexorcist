import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";

import { useTheme } from "@/theme";

import { AppText } from "./text";

export type DropdownOption<T extends string | number> = {
  value: T;
  label: string;
  /** Optional right-aligned detail, e.g. "4 weeks". */
  meta?: string;
};

type DropdownProps<T extends string | number> = {
  label?: string;
  options: DropdownOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Heading shown above the options once the menu is open. */
  title?: string;
};

/**
 * Single-select dropdown. A closed row that opens the options over a scrim —
 * the same matte surface and hairline border as Card, so it sits in the type
 * ramp instead of importing a platform control's own look.
 */
export function Dropdown<T extends string | number>({
  label,
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  title,
}: DropdownProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;

  function pick(next: T) {
    setOpen(false);
    if (next !== value) onChange(next);
  }

  return (
    <View className="gap-2">
      {label ? <AppText variant="label">{label}</AppText> : null}

      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: open }}
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        className={`flex-row items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 ${
          disabled ? "opacity-70" : "active:bg-canvas"
        }`}
      >
        <AppText
          variant="bodyMedium"
          className="flex-1"
          tone={selected ? "default" : "faint"}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </AppText>
        {selected?.meta ? (
          <AppText variant="caption" tone="muted">
            {selected.meta}
          </AppText>
        ) : null}
        <SymbolView
          name={{
            ios: "chevron.up.chevron.down",
            android: "unfold_more",
            web: "unfold_more",
          }}
          size={16}
          tintColor={theme.muted}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityLabel="Close menu"
          className="flex-1 justify-center bg-black/40 px-6"
        >
          {/* Swallow taps inside the sheet so they don't reach the scrim. */}
          <Pressable
            onPress={() => {}}
            className="max-h-[70%] overflow-hidden rounded-card border border-line bg-surface"
          >
            {title ? (
              <View className="border-b border-line px-4 py-3">
                <AppText variant="label" tone="muted">
                  {title}
                </AppText>
              </View>
            ) : null}
            <ScrollView contentContainerClassName="py-1">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={String(option.value)}
                    onPress={() => pick(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    className={`flex-row items-center gap-3 px-4 py-3 ${
                      isSelected ? "bg-accent-soft" : "active:bg-canvas"
                    }`}
                  >
                    <View className="flex-1 gap-0.5">
                      <AppText
                        variant="bodyMedium"
                        tone={isSelected ? "accent" : "default"}
                      >
                        {option.label}
                      </AppText>
                      {option.meta ? (
                        <AppText
                          variant="caption"
                          tone={isSelected ? "accent" : "muted"}
                        >
                          {option.meta}
                        </AppText>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <SymbolView
                        name={{ ios: "checkmark", android: "check", web: "check" }}
                        size={16}
                        tintColor={theme.accent}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
