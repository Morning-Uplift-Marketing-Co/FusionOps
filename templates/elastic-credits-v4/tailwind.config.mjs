/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1200px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Lexend"', 'system-ui', 'sans-serif'],
        display: ['"Lexend"', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        sm: '0 1px 2px 0 hsl(350 75% 38% / 0.05)',
        md: '0 4px 6px -1px hsl(350 75% 38% / 0.1), 0 2px 4px -2px hsl(350 75% 38% / 0.1)',
        lg: '0 10px 15px -3px hsl(350 75% 38% / 0.1), 0 4px 6px -4px hsl(350 75% 38% / 0.1)',
        xl: '0 20px 25px -5px hsl(350 75% 38% / 0.1), 0 8px 10px -6px hsl(350 75% 38% / 0.1)',
        cta: '0 4px 14px 0 hsl(40 90% 55% / 0.4)',
        card: '0 10px 15px -3px hsl(350 75% 38% / 0.08), 0 4px 6px -4px hsl(350 75% 38% / 0.06)',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, hsl(350 75% 38%) 0%, hsl(350 75% 28%) 100%)',
        'cta-gradient': 'linear-gradient(135deg, hsl(40 90% 55%) 0%, hsl(40 90% 45%) 100%)',
        'success-gradient': 'linear-gradient(135deg, hsl(200 70% 45%) 0%, hsl(200 70% 39%) 100%)',
        'trust-gradient': 'linear-gradient(180deg, hsl(350 15% 97%) 0%, hsl(350 15% 95%) 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        'pulse-soft': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.75)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s ease-out forwards',
        'fade-up-delay-1': 'fade-up 0.6s ease-out 0.1s forwards',
        'fade-up-delay-2': 'fade-up 0.6s ease-out 0.2s forwards',
        'fade-up-delay-3': 'fade-up 0.6s ease-out 0.3s forwards',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'slide-up': 'slide-up 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.2s ease-out forwards',
        shake: 'shake 0.4s ease-in-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'spin-slow': 'spin-slow 1.5s linear infinite',
      },
    },
  },
  plugins: [],
};
