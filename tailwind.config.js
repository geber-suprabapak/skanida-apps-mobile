/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

module.exports = {
  content: ["./app/**/*.{js,ts,tsx}", "./components/**/*.{js,ts,tsx}"],

  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: colors.yellow, // Keep existing primary or adjust as needed
        'brand-purple': '#E600FF',
        'brand-green': '#28a745',
        'brand-blue': '#007AFF',
        'brand-red': '#dc3545',
        'brand-gray': {
          DEFAULT: '#8e8e93', // For icons/text
          light: '#c7c7cc', // For borders/icons
          lighter: '#e5e5ea', // For switch track
          dark: '#6c757d', // Read message icon
          darker: '#212121', // Tertiary button icon
        },
        'brand-background': { // Define background colors if needed
          DEFAULT: '#f8f8f8', // Example light background
          dark: '#121212', // Example dark background
        }
      },
    },
  },
  plugins: [],
};
