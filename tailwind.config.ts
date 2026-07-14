import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-source-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"]
      },
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        card: "var(--color-card)",
        border: "var(--color-border)",
        muted: "var(--color-muted)",
        "muted-foreground": "var(--color-muted-foreground)",
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)"
        },
        secondary: "var(--color-secondary)",
        lightprimary: "var(--color-lightprimary)",
        lightinfo: "var(--color-lightinfo)",
        "sidebar-foreground": "var(--color-sidebar-foreground)",
        rail: {
          DEFAULT: "var(--color-rail)",
          foreground: "var(--color-rail-foreground)",
          accent: "var(--color-rail-accent)"
        },
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        error: "var(--color-error)",
        info: "var(--color-info)"
      },
      boxShadow: {
        card: "var(--shadow-card)",
        lifted: "var(--shadow-lifted)"
      },
      borderRadius: {
        lg: "var(--radius-lg)"
      }
    }
  },
  plugins: []
};

export default config;
