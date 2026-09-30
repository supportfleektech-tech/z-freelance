import type { Config } from "tailwindcss";

/**
 * z-freelance identity: deep forest green + warm gold on warm paper.
 * Deliberately NOT the default SaaS blue — green is the money/trust story
 * (escrow), gold is the "value delivered" moment, ink is a warm taupe so
 * the whole product feels crafted rather than templated.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef9f1",
          100: "#d7f1df",
          200: "#b2e3c3",
          300: "#7fd0a1",
          400: "#46b87c",
          500: "#1f9d60",
          600: "#0e8049",
          700: "#0c673d",
          800: "#0d5333",
          900: "#0c452d",
          950: "#052717",
        },
        ink: {
          50: "#f8f7f4",
          100: "#efeeea",
          200: "#dcd9d2",
          300: "#bfb9ae",
          400: "#9d968a",
          500: "#817a6e",
          600: "#69635a",
          700: "#565149",
          800: "#484540",
          900: "#3e3b37",
          950: "#1a1815",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(60 55 40 / 0.05), 0 2px 8px -2px rgb(60 55 40 / 0.08)",
        pop: "0 16px 40px -12px rgb(20 24 21 / 0.22), 0 4px 12px -6px rgb(20 24 21 / 0.12)",
        glow: "0 0 0 1px rgb(14 128 73 / 0.25), 0 8px 28px -8px rgb(14 128 73 / 0.45)",
        gold: "0 6px 24px -8px rgb(217 160 30 / 0.55)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "60%": { opacity: "1", transform: "scale(1.03)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-14px) rotate(1deg)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-22px)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "caret-blink": {
          "0%, 45%": { opacity: "1" },
          "50%, 95%": { opacity: "0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "80%, 100%": { transform: "scale(1.9)", opacity: "0" },
        },
        aurora: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(40px, -30px) scale(1.15)" },
          "66%": { transform: "translate(-30px, 20px) scale(0.95)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(4deg)" },
        },
        "coin-in": {
          "0%": { opacity: "0", transform: "translate(60px, -40px) rotate(40deg)" },
          "60%": { opacity: "1", transform: "translate(-6px, 6px) rotate(-8deg)" },
          "100%": { opacity: "1", transform: "translate(0, 0) rotate(0deg)" },
        },
        "confetti-burst": {
          "0%": { opacity: "1", transform: "translate(0, 0) rotate(0deg)" },
          "100%": { opacity: "0", transform: "translate(var(--dx), var(--dy)) rotate(var(--rz))" },
        },
        "doc-fly": {
          "0%": { opacity: "0", transform: "translate(-60px, 20px) rotate(-12deg) scale(0.8)" },
          "30%": { opacity: "1" },
          "100%": { opacity: "1", transform: "translate(0, 0) rotate(0deg) scale(1)" },
        },
        "draw-check": {
          from: { strokeDashoffset: "34" },
          to: { strokeDashoffset: "0" },
        },
        "bar-grow": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out both",
        "fade-up": "fade-up 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "pop-in": "pop-in 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        float: "float 5s ease-in-out infinite",
        "float-slow": "float-slow 7s ease-in-out infinite",
        marquee: "marquee 36s linear infinite",
        "marquee-slow": "marquee 52s linear infinite",
        "caret-blink": "caret-blink 1.1s step-end infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        aurora: "aurora 16s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite, fade-in 200ms ease-out both",
        wiggle: "wiggle 2.4s ease-in-out infinite",
        "coin-in": "coin-in 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "doc-fly": "doc-fly 900ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "draw-check": "draw-check 500ms ease-out 200ms both",
        "bar-grow": "bar-grow 900ms cubic-bezier(0.22, 1, 0.36, 1) 300ms both",
      },
    },
  },
  plugins: [],
};

export default config;
