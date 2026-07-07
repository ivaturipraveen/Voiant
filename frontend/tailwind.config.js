/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Light theme. "navy" is repurposed as a neutral dark slate for text/icons
        // (no more dark-blue surfaces); the accent is the green from the Voiant mark.
        navy: {
          DEFAULT: "#211E56", // Voiant indigo-navy — headings & dark text
          deep: "#0F1B2C", // near-black navy — top header & primary buttons
          light: "#2E2A6B",
          line: "#CBD5E1",
        },
        ink: "#1E293B",
        slatebody: "#64748B",
        brand: {
          DEFAULT: "#34B7AD", // Voiant teal
          dark: "#268E86",
          light: "#5FD3C9",
        },
        flag: {
          bg: "#FFF9ED", // cream — flagged metric tiles / warning callouts
          border: "#F2E6C7",
          text: "#B7791F",
        },
        band: {
          under: "#3B82F6",
          equitable: "#22C55E",
          stretched: "#F59E0B",
          overloaded: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["'Source Sans 3'", "system-ui", "Arial", "sans-serif"],
        display: ["Figtree", "'Source Sans 3'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(33,30,86,0.04), 0 10px 30px -14px rgba(33,30,86,0.14)",
      },
    },
  },
  plugins: [],
};
