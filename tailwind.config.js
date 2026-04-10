/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#7c3aed",
        dark   : "#0f0f1a",
        card   : "#1a1a2e",
        border : "#2d2d4e",
      }
    },
  },
  plugins: [],
}
