/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      colors: {
        bg: '#0B0B0F',
        'bg-soft': '#13111C',
        card: '#1A1333',
        'card-hover': '#241844',
        border: '#27272A',
        accent: '#8B5CF6',
        'accent-soft': '#6D28D9',
        'accent-bright': '#EC4899',
        muted: '#9CA3AF',
        // Remap emerald -> acid green (income)
        emerald: {
          50:  '#f3fbe0',
          100: '#e4f6c0',
          200: '#caed87',
          300: '#b0e450',
          400: '#9de131',
          500: '#84CC16',
          600: '#68a50f',
          700: '#4f7d0b',
          800: '#375507',
          900: '#263c05',
        },
        // Remap rose -> hot pink (expenses)
        rose: {
          50:  '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#EC4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#701a3a',
        },
      },
      boxShadow: {
        'glow-accent': '0 0 24px -8px rgba(139, 92, 246, 0.35)',
        'glow-rose': '0 0 24px -8px rgba(236, 72, 153, 0.35)',
        'glow-emerald': '0 0 24px -8px rgba(132, 204, 22, 0.30)',
        'card': '0 2px 16px -4px rgba(0, 0, 0, 0.6)',
        'card-hover': '0 6px 28px -6px rgba(109, 40, 217, 0.35)',
        'hard': '4px 4px 0 0 rgba(0, 0, 0, 0.8)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(ellipse at top, var(--tw-gradient-stops))',
        'accent-gradient': 'linear-gradient(135deg, #6D28D9 0%, #EC4899 100%)',
        'accent-gradient-hover': 'linear-gradient(135deg, #7C3AED 0%, #C026D3 100%)',
        'rose-gradient': 'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
        'emerald-gradient': 'linear-gradient(135deg, #84CC16 0%, #B0E450 100%)',
        'mesh': 'radial-gradient(at 15% 8%, rgba(109,40,217,0.18) 0%, transparent 45%), radial-gradient(at 85% 0%, rgba(236,72,153,0.10) 0%, transparent 45%), radial-gradient(at 0% 90%, rgba(139,92,246,0.08) 0%, transparent 40%)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 8s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        gradient: {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        shimmer: {
          '0%': { 'background-position': '-200% 0' },
          '100%': { 'background-position': '200% 0' },
        },
      },
      transitionDuration: {
        '120': '120ms',
      },
    },
  },
  plugins: [],
};
