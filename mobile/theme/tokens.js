/**
 * Flexorcist design tokens — "Chalk & Iron".
 *
 * Single source of truth. Consumed by:
 *  - tailwind.config.js  → emits CSS variables for NativeWind classes
 *  - theme/index.ts      → exposes the same values to native props
 *                          (tab bar, placeholders, icon tints)
 *
 * Kept as CommonJS so Tailwind can require it at build time.
 */

const palette = {
  light: {
    // Surfaces
    canvas: "#F1F2F4", // chalk: cool grey, not cream
    surface: "#FFFFFF",
    line: "#DDE0E5",
    // Text
    ink: "#1B1F26", // iron: blue-black
    muted: "#5C6470",
    faint: "#9AA3AF",
    // Brand
    accent: "#5E45D6",
    "accent-soft": "#ECE8FB",
    "on-accent": "#FFFFFF",
    // Feedback
    danger: "#C43D3D",
    "danger-soft": "#FBE7E7",
    done: "#1B7A4A",
    "done-soft": "#D7F3E3",
    // Workout locations — these hues only ever mean location
    home: "#9A6316",
    "home-soft": "#F8EBD3",
    park: "#3F7A3C",
    "park-soft": "#E2F0DF",
    gym: "#33609E",
    "gym-soft": "#E0EAF7",
  },
  dark: {
    canvas: "#15181D",
    surface: "#1F242B",
    line: "#2E3540",
    ink: "#ECEEF1",
    muted: "#A3ABB6",
    faint: "#6B7482",
    accent: "#A597FF",
    "accent-soft": "#2A2550",
    "on-accent": "#15181D",
    danger: "#F07B7B",
    "danger-soft": "#3A2224",
    done: "#5FD49A",
    "done-soft": "#1A3228",
    home: "#E0A64A",
    "home-soft": "#3A2E1A",
    park: "#7DBD78",
    "park-soft": "#1F3120",
    gym: "#7AA6E8",
    "gym-soft": "#1C2A40",
  },
};

/** Barlow superfamily: condensed for display/numerals, regular width for body. */
const fonts = {
  display: "BarlowCondensed_600SemiBold",
  displayBold: "BarlowCondensed_700Bold",
  body: "Barlow_400Regular",
  bodyMedium: "Barlow_500Medium",
  bodySemibold: "Barlow_600SemiBold",
};

/** Radius hierarchy: controls < cards < capsules. */
const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
};

module.exports = { palette, fonts, radius };
