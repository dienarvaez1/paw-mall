/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0F766E',
          dark: '#115E59',
        },
        // The Paw-Mall logo's turquoise (#00C1C0) with 10% white, for buttons and selected
        // controls. White text on it is too faint, so labels use teal-950 (#042F2E, over 8:1).
        paw: {
          DEFAULT: '#1AC7C6',
          dark: '#1AACAB',
        },
      },
    },
  },
  plugins: [],
};
