export type ColorToken =
  | "canvas"
  | "surface"
  | "line"
  | "ink"
  | "muted"
  | "faint"
  | "accent"
  | "accent-soft"
  | "on-accent"
  | "danger"
  | "danger-soft"
  | "done"
  | "done-soft"
  | "home"
  | "home-soft"
  | "park"
  | "park-soft"
  | "gym"
  | "gym-soft";

export type Palette = Record<ColorToken, string>;

export const palette: { light: Palette; dark: Palette };

export const fonts: {
  display: string;
  displayBold: string;
  body: string;
  bodyMedium: string;
  bodySemibold: string;
};

export const radius: {
  sm: number;
  md: number;
  lg: number;
  full: number;
};
