/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Light theme. "navy" is repurposed as a neutral dark slate for text/icons
        // (no more dark-blue surfaces); the accent is the green from the Voiant mark.
        navy: {
          DEFAULT: "#1E293B", // slate-800 — headings & dark text
          deep: "#0F172A",
          light: "#334155",
          line: "#CBD5E1",
        },
        ink: "#1E293B",
        slatebody: "#64748B",
        brand: {
          DEFAULT: "#2FA85C", // Voiant green (from the logo blade)
          dark: "#237D44",
          light: "#63C486",
        },
        band: {
          under: "#3B82F6",
          equitable: "#22C55E",
          stretched: "#F59E0B",
          overloaded: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Arial", "sans-serif"],
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(33,30,86,0.04), 0 10px 30px -14px rgba(33,30,86,0.14)",
      },
    },
  },
  plugins: [],
};
