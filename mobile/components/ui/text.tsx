import { Text, type TextProps } from "react-native";

/**
 * Type ramp. Display styles use Barlow Condensed (signage / plate numerals);
 * body styles use Barlow. Never combine these with `font-bold` — the weight is
 * baked into the font file.
 */
const variants = {
  display: "font-display-bold text-[34px] leading-[38px]",
  title: "font-display text-[26px] leading-[30px]",
  heading: "font-display text-[21px] leading-6",
  numeral: "font-display-bold text-[28px] leading-8",
  body: "font-body text-base leading-6",
  bodyMedium: "font-body-medium text-base leading-6",
  label: "font-body-medium text-sm leading-5",
  small: "font-body text-sm leading-5",
  caption: "font-body text-xs leading-4",
} as const;

const tones = {
  default: "text-ink",
  muted: "text-muted",
  faint: "text-faint",
  accent: "text-accent",
  danger: "text-danger",
  done: "text-done",
  onAccent: "text-on-accent",
} as const;

export type TextVariant = keyof typeof variants;
export type TextTone = keyof typeof tones;

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
};

export function AppText({
  variant = "body",
  tone = "default",
  className,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      className={`${variants[variant]} ${tones[tone]} ${className ?? ""}`}
    />
  );
}
