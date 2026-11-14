import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

import { artEditor } from './src/dev/art-editor'
import { bitLab } from './src/dev/bit-lab'

export default defineConfig({
  // A flat /index.html rather than a directory per route.
  build: { format: 'file' },
  vite: { plugins: [tailwindcss()] },
  // Dev only: the art editor's and the bit lab's save endpoints. Never run for a build.
  integrations: [artEditor(), bitLab()],
})
