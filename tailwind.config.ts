// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border:     "hsl(var(--border) / <alpha-value>)",
        card:       "hsl(var(--card) / <alpha-value>)",
        popover:    "hsl(var(--popover) / <alpha-value>)",

        // För text-fg/text-muted om du använder dem:
        fg:    "hsl(var(--foreground) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",

        // Brand/status (om du använder dem i UI):
        primary: "hsl(var(--primary) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        danger:  "hsl(var(--danger) / <alpha-value>)",
      },
      boxShadow: {
        // Justera efter smak
        soft:
          "0 1px 2px 0 hsl(var(--foreground) / 0.06), 0 1px 1px -1px hsl(var(--foreground) / 0.10)",
      },
      borderRadius: {
        // Om du vill behålla rounded-xl2
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
