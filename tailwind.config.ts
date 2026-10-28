import type { Config } from "tailwindcss";

// Soft Lavender palette sampled directly from user's reference image (#d4c8ee)
// Engineered with deep contrast shades (700/800/900/950) so text is strikingly prominent
const softLavender = {
  50: '#f9f7fd',
  100: '#f1ebfa',
  200: '#d4c8ee', // Exact user sample: Soft Lavender
  300: '#c0aee4',
  400: '#a68dd6',
  500: '#8c6bc6',
  600: '#7249b5', // Primary action button (6.25:1 contrast with white text)
  700: '#5c359a', // Prominent text on light backgrounds (AAA contrast)
  800: '#4a2680', // Deep headers & titles (10:1+ contrast)
  900: '#381a66', // Maximum contrast text & key amounts
  950: '#250e47', // Ultra-bold deep plum
};

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        rose: softLavender,
        purple: softLavender,
        lavender: softLavender,
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
