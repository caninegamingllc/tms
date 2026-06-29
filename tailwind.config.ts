import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "#dbe3ef",
        ink: "#102033",
        muted: "#667085",
        panel: "#ffffff",
        soft: "#f5f7fb",
        brand: {
          50: "#eef8ff",
          100: "#d9efff",
          500: "#1677c8",
          600: "#0f63aa",
          700: "#0c4f89"
        }
      },
      boxShadow: {
        card: "0 10px 30px rgba(15, 35, 55, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
