import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'soft-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        'soft-dark': '0 4px 20px -2px rgba(0, 0, 0, 0.3)',
        'soft-hover-dark': '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
      },
      colors: {
        // Monochrome Light Theme
        background: "var(--background)",
        surface: "var(--surface)",
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        muted: "var(--muted)",
        border: "var(--border)",
        // Status colors (subtle monochrome variants)
        accent: {
          green: "var(--accent-positive)",
          greenLight: "var(--accent-positive-light)",
          red: "var(--accent-negative)",
          redLight: "var(--accent-negative-light)",
          yellow: "var(--accent-warning)",
          yellowLight: "var(--accent-warning-light)",
        }
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
