import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// BACKEND_URL is injected by docker-compose (http://backend:8000 inside Docker,
// falls back to http://localhost:8000 for plain "npm run dev" on the host).
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // needed so the container is reachable from the host
    port: 5173,
    proxy: {
      // All /api requests go through the proxy — no CORS issues
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
})
