/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#f0e6cc",
        "parchment-dark": "#ddd0a8",
        ink:    "#1a1208",
        "ink-light": "#3a2e1a",
        crimson: "#7c1a1a",
        gold:   "#b8860b",
        "gold-light": "#d4a827",
        "snake-dark":  "#1a2e1a",
        "snake-mid":   "#2d5a27",
        "snake-light": "#4a7c42",
        food:   "#8b1a1a",
      },
      fontFamily: {
        book:  ['"Lora"', 'Georgia', 'serif'],
        title: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      keyframes: {
        flicker: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.85' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        flicker: 'flicker 3s ease-in-out infinite',
        fadeIn:  'fadeIn 0.6s ease both',
      },
    },
  },
  plugins: [],
};
