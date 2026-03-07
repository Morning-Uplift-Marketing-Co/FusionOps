/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          600: "#0284c7",
          800: "#075985",
          900: "#0c4a6e",
        },
      },
      boxShadow: {
        soft: "0 18px 45px -28px rgba(12, 74, 110, 0.35)",
      },
    },
  },
  plugins: [],
};

