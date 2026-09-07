import { View, type ViewProps } from "react-native";

export type CardProps = ViewProps & { className?: string };

/** Matte surface with a hairline border. No shadows — iron and rubber don't glow. */
export function Card({ className, ...props }: CardProps) {
  return (
    <View
      {...props}
      className={`rounded-card border border-line bg-surface px-4 py-4 ${className ?? ""}`}
    />
  );
}
