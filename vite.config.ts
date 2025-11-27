import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'src': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://deepseek-api-key.lexsnitko.workers.dev',
        changeOrigin: true,
        secure: true,
        // Если воркер НЕ ожидает префикс /api (т.е. он обрабатывает /me вместо /api/me),
        // раскомментируй rewrite:
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})