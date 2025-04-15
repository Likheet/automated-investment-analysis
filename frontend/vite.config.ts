import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001', // Changed to 5001 to match the actual backend port
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
