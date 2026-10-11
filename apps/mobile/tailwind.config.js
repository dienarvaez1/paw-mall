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
        // The Paw-Mall logo's turquoise (#00C1C0), lightened twice by 10% white, for buttons and
        // selected controls. White text on it is too faint, so labels use teal-950 (#042F2E).
        paw: {
          DEFAULT: '#31CDCC',
          dark: '#31B4B3',
        },
      },
    },
  },
  plugins: [],
};
