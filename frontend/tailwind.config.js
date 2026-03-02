/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2563EB",
        secondary: "#34D399",
        accent: "#A78BFA",
        background: "#FFFFFF",
        textmain: "#374151"
      }
    }
  },
  plugins: []
}