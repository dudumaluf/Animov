import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-secondary": "var(--bg-secondary)",
        "text-primary": "var(--text)",
        "text-secondary": "var(--text-secondary)",
        "accent-gold": "var(--accent-gold)",
        "accent-green": "var(--accent-green)",
        border: "var(--border)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        "display-xl": ["clamp(3.5rem, 8vw, 7.5rem)", { lineHeight: "0.95", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(2.5rem, 5vw, 4rem)", { lineHeight: "1.05", letterSpacing: "-0.01em" }],
        "display-md": ["clamp(2rem, 3.5vw, 3rem)", { lineHeight: "1.1" }],
        "label-sm": ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.12em" }],
        "label-xs": ["0.625rem", { lineHeight: "1.4", letterSpacing: "0.14em" }],
      },
      borderRadius: {
        card: "8px",
      },
      boxShadow: {
        "card-warm": "0 8px 40px rgba(0,0,0,0.10)",
        "card-warm-lg": "0 16px 64px rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [],
};
export default config;
