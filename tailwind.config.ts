import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./src/pages/**/*.{ts,tsx}",
    "./**/*.mdx",
  ],
  darkMode: "class",
  theme: {
    boxShadow: {
      soft: "0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 1px -1px rgb(15 23 42 / 0.10)",
    },
    borderRadius: {
      xl2: "1.25rem",
    },
  },
  plugins: [],
} satisfies Config;
