/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          50: '#f0f2ff',
          100: '#e7eaff',
          200: '#d3d8ff',
          300: '#b9c1ff',
          400: '#9ba3ff',
          500: '#7c7fff',
          600: '#5865f2',
          700: '#4752c4',
          800: '#3b4298',
          900: '#343a78',
        }
      }
    },
  },
  plugins: [],
} 