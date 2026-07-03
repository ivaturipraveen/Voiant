/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Voiant brand palette (voiantclinical.com): deep indigo-navy + teal.
        navy: {
          DEFAULT: "#211E56",
          deep: "#16133A",
          light: "#2E2A6B",
          line: "#3A3680",
        },
        ink: "#1B1A38",
        slatebody: "#5A5A77",
        brand: {
          DEFAULT: "#34B7AD", // Voiant teal
          dark: "#268E86",
          light: "#5FD3C9",
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
