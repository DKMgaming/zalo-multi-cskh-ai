/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        zalo: {
          blue: "#0068FF",
          light: "#E5EFFF",
          dark: "#0052CC",
        },
      },
    },
  },
  plugins: [],
}
