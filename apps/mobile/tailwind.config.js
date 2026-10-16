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
        // The Pet Helper logo's turquoise (#00C1C0), lightened three times by 10% white, for buttons
        // and selected controls. White text on it is too faint, so labels use teal-950 (#042F2E).
        paw: {
          DEFAULT: '#46D2D1',
          dark: '#46BCBB',
        },
        // Unselected buttons (as the radius button after zooming the map by hand): amber-500,
        // amber-50, amber-950 and amber-100 lightened by 10% white. Labels stay amber-900/200.
        off: {
          border: '#F6A823',
          bg: '#FFFBED',
          'bg-dark': '#58311C',
          pressed: '#FEF4CD',
        },
      },
    },
  },
  plugins: [],
};
