import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Remove products.json from build output (103MB, only used by scripts not the frontend)
    {
      name: 'exclude-products-json',
      closeBundle() {
        const fs = require('fs')
        const path = require('path')
        const target = path.resolve(__dirname, 'dist', 'data', 'products.json')
        if (fs.existsSync(target)) {
          fs.unlinkSync(target)
        }
      }
    }
  ],
})
