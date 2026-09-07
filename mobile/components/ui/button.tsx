import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, type PressableProps } from "react-native";

import { useTheme } from "@/theme";
import { AppText } from "./text";

const variants = {
  primary: {
    container: "bg-accent active:opacity-85",
    text: "onAccent",
    spinner: "on-accent",
  },
  secondary: {
    container: "border border-line bg-surface active:bg-canvas",
    text: "default",
    spinner: "ink",
  },
  ghost: {
    container: "active:bg-accent-soft",
    text: "accent",
    spinner: "accent",
  },
  danger: {
    container: "border border-danger bg-danger-soft active:opacity-85",
    text: "danger",
    spinner: "danger",
  },
} as const;

const sizes = {
  md: "px-4 py-3",
  lg: "px-5 py-3.5",
} as const;

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  title: string;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
};

export function Button({
  title,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled,
  icon,
  className,
  ...props
}: ButtonProps) {
  const theme = useTheme();
  const styles = variants[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      {...props}
      className={`flex-row items-center justify-center gap-2 rounded-control ${styles.container} ${sizes[size]} ${isDisabled ? "opacity-50" : ""} ${className ?? ""}`}
    >
      {loading ? (
        <ActivityIndicator color={theme[styles.spinner]} />
      ) : (
        <>
          {icon}
          <AppText variant="bodyMedium" tone={styles.text}>
            {title}
          </AppText>
        </>
      )}
    </Pressable>
  );
}
