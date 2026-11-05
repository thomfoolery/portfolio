import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  // A flat /index.html rather than a directory per route.
  build: { format: 'file' },
  vite: { plugins: [tailwindcss()] },
})
