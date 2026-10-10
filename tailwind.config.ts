import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import tailwindcssAnimate from "tailwindcss-animate";
import containerQueries from "@tailwindcss/container-queries";

/**
 * `pb-safe-4` = 1rem + the bottom safe-area inset. The bare `.pb-safe` family in
 * globals.css *replaces* the padding with the inset, which is 0 on most
 * screens; these add to a spacing step instead, for bars that need both.
 */
const safeAreaSpacing = plugin(({ matchUtilities, theme }) => {
  const inset = (side: "top" | "right" | "bottom" | "left") =>
    `env(safe-area-inset-${side}, 0px)`;
  matchUtilities(
    {
      "pt-safe": (value: string) => ({ paddingTop: `calc(${value} + ${inset("top")})` }),
      "pb-safe": (value: string) => ({ paddingBottom: `calc(${value} + ${inset("bottom")})` }),
      "pl-safe": (value: string) => ({ paddingLeft: `calc(${value} + ${inset("left")})` }),
      "pr-safe": (value: string) => ({ paddingRight: `calc(${value} + ${inset("right")})` }),
      "mb-safe": (value: string) => ({ marginBottom: `calc(${value} + ${inset("bottom")})` }),
      "bottom-safe": (value: string) => ({ bottom: `calc(${value} + ${inset("bottom")})` }),
    },
    { values: theme("spacing") }
  );
});

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  // `.dark { --tokens }` lives in @layer base, which Tailwind drops unless
  // "dark" appears in scanned content; next-themes adds it at runtime.
  safelist: ["dark"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Backdrop the A4 paper sits on in previews; deliberately not --muted.
        ground: "hsl(var(--ground))",
        paper: {
          DEFAULT: "hsl(var(--paper))",
          foreground: "hsl(var(--paper-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "0 1px 2px 0 hsl(var(--shadow-color) / 0.04), 0 1px 3px 0 hsl(var(--shadow-color) / 0.06)",
        elevated:
          "0 10px 24px -6px hsl(var(--shadow-color) / 0.12), 0 4px 8px -4px hsl(var(--shadow-color) / 0.08)",
      },
      fontFamily: {
        // Inter (via --font-sans) has no CJK glyphs; the browser falls through
        // to the first installed Traditional Chinese face per character.
        sans: [
          "var(--font-sans, ui-sans-serif)",
          '"PingFang TC"',
          '"Noto Sans TC"',
          '"Microsoft JhengHei"',
          "system-ui",
          "sans-serif",
        ],
      },
      aria: {
        // Enables `aria-invalid:` (not in Tailwind 3's default aria list).
        invalid: 'invalid="true"',
      },
    },
  },
  plugins: [tailwindcssAnimate, containerQueries, safeAreaSpacing],
};

export default config;
