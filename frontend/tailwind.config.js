/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"DM Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        bg: '#0a0f1e',
        'bg-soft': '#0f172a',
        card: '#141c2f',
        'card-hover': '#1a2438',
        border: '#1f2a44',
        accent: '#38bdf8',
        'accent-soft': '#0ea5e9',
        muted: '#64748b',
      },
      boxShadow: {
        'glow-accent': '0 0 40px -10px rgba(56, 189, 248, 0.45)',
        'glow-rose': '0 0 40px -10px rgba(244, 63, 94, 0.35)',
        'glow-emerald': '0 0 40px -10px rgba(16, 185, 129, 0.35)',
        'card': '0 4px 24px -8px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 8px 32px -8px rgba(56, 189, 248, 0.25)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(ellipse at top, var(--tw-gradient-stops))',
        'accent-gradient': 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
        'rose-gradient': 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
        'emerald-gradient': 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
        'mesh': 'radial-gradient(at 20% 10%, rgba(56,189,248,0.12) 0%, transparent 40%), radial-gradient(at 80% 0%, rgba(129,140,248,0.10) 0%, transparent 45%), radial-gradient(at 0% 80%, rgba(244,63,94,0.07) 0%, transparent 40%)',
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
    },
  },
  plugins: [],
};
