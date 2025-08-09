import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// הגדרות Vite עבור פרויקט React
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist'
  }
})
