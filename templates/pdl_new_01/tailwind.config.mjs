/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#1E3A5F', // Navy Blue
                    dark: '#112233',
                },
                accent: {
                    DEFAULT: '#22C55E', // Emerald Green
                    hover: '#16A34A',   // Emerald-600
                },
                background: {
                    DEFAULT: '#FFFFFF', // Pure White
                    alt: '#F3F4F6',    // Gray-100 (Secondary section)
                },
                charcoal: {
                    DEFAULT: '#1F2937', // Gray-800 (Primary text)
                    light: '#4B5563',   // Gray-600 (Muted text)
                    muted: '#9CA3AF',   // Gray-400
                }
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                'soft': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                'premium': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                'accent-glow': '0 0 15px rgba(34, 197, 94, 0.2)',
            }
        },
    },
    plugins: [],
}
