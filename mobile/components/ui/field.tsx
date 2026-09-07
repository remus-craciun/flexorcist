import type { ReactNode } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "@/theme";
import { AppText } from "./text";

export type FieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  /** Rendered inside the control on the trailing edge (e.g. a toggle). */
  accessory?: ReactNode;
  className?: string;
  containerClassName?: string;
};

/** Labelled text input on a matte surface with a hairline border. */
export function Field({
  label,
  error,
  accessory,
  className,
  containerClassName,
  editable = true,
  ...props
}: FieldProps) {
  const theme = useTheme();

  return (
    <View className={`gap-2 ${containerClassName ?? ""}`}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <View
        className={`flex-row items-center rounded-control border bg-surface ${
          error ? "border-danger" : "border-line"
        } ${editable ? "" : "opacity-60"}`}
      >
        <TextInput
          editable={editable}
          placeholderTextColor={theme.faint}
          selectionColor={theme.accent}
          {...props}
          className={`min-h-[48px] flex-1 px-4 font-body text-base text-ink ${className ?? ""}`}
        />
        {accessory}
      </View>
      {error ? (
        <AppText variant="small" tone="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
