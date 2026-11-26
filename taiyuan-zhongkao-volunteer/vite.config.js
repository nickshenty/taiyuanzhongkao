import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 开发期把 /api 代理到本地后端，避免跨域
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:3002',
        changeOrigin: true,
      },
    },
  },
})
