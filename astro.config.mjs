import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

import { artEditor } from './src/dev/art-editor'

export default defineConfig({
  // A flat /index.html rather than a directory per route.
  build: { format: 'file' },
  vite: { plugins: [tailwindcss()] },
  // Dev only: the art editor's save endpoint. Never runs for a build.
  integrations: [artEditor()],
})
