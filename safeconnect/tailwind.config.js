module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        safe: {
          50:  "#f0f9fc",
          100: "#e0f3f8",
          200: "#b8e2ed",
          300: "#7ec9dd",
          400: "#4db0cc",
          500: "#2196b5",
          600: "#1a7a94",
          700: "#135f72",
          800: "#0f4c5c",
          900: "#0c3d4a",
          950: "#071f27",
        },
        warm: {
          50:  "#fdf9f3",
          100: "#faf3e6",
          200: "#f5e2c0",
          300: "#edca8a",
          400: "#e4b05a",
          500: "#d9922a",
          600: "#c07820",
          700: "#9a5e18",
          800: "#7a4a14",
          900: "#5c380f",
        },
        cream: "#faf8f5",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        "glow-safe": "0 0 24px 0 rgba(26,122,148,0.18)",
        "card":      "0 2px 16px 0 rgba(15,76,92,0.08)",
        "card-lg":   "0 8px 40px 0 rgba(15,76,92,0.12)",
      },
      animation: {
        "fade-in":   "fadeIn 0.4s ease both",
        "slide-up":  "slideUp 0.5s ease both",
        "pulse-soft":"pulseSoft 2.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:    { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:   { "0%": { opacity: "0", transform: "translateY(24px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        pulseSoft: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.6" } },
      },
    },
  },
  plugins: [],
}

