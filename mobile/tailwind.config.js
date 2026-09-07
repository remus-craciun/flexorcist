const plugin = require("tailwindcss/plugin");
const { palette, fonts, radius } = require("./theme/tokens");

/** Map a palette to CSS custom properties: { "--color-ink": "#1B1F26", ... } */
function toCssVars(colors) {
  return Object.fromEntries(
    Object.entries(colors).map(([name, value]) => [`--color-${name}`, value]),
  );
}

/** Tailwind color names → var() references, so light/dark swap at runtime. */
const colors = Object.fromEntries(
  Object.keys(palette.light).map((name) => [name, `var(--color-${name})`]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
      fontFamily: {
        display: [fonts.display],
        "display-bold": [fonts.displayBold],
        body: [fonts.body],
        "body-medium": [fonts.bodyMedium],
        "body-semibold": [fonts.bodySemibold],
      },
      borderRadius: {
        control: `${radius.md}px`,
        card: `${radius.lg}px`,
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ":root": toCssVars(palette.light),
        "@media (prefers-color-scheme: dark)": {
          ":root": toCssVars(palette.dark),
        },
      });
    }),
  ],
};
