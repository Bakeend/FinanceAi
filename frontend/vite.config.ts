import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:3001'
const API_PATHS = [
  '/auth', '/transactions', '/accounts', '/dashboard', '/goals', '/reminders',
  '/trips', '/budgets', '/rules', '/ai', '/backup', '/health',
]

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // aceita conexões da LAN (ex: celular na mesma WiFi)
    proxy: Object.fromEntries(
      API_PATHS.map((p) => [p, { target: API_TARGET, changeOrigin: true }]),
    ),
  },
})
