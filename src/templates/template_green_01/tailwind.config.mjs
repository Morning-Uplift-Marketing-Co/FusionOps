export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'hsl(174 72% 32%)',
        'primary-dark': 'hsl(174 72% 24%)',
        secondary: 'hsl(174 64% 42%)',
        accent: 'hsl(32 95% 54%)',
        background: 'hsl(0 0% 100%)',
        foreground: 'hsl(0 0% 10%)',
        card: 'hsl(0 0% 100%)',
        'card-foreground': 'hsl(0 0% 10%)',
        muted: 'hsl(210 40% 96%)',
        'muted-foreground': 'hsl(215 16% 47%)',
        border: 'hsl(214 32% 91%)',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
