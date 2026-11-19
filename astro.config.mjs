import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

import { artEditor } from './src/dev/art-editor'
import { bitLab } from './src/dev/bit-lab'
import { designSystem } from './src/dev/design-system'

export default defineConfig({
  // A flat /index.html rather than a directory per route.
  build: { format: 'file' },
  vite: { plugins: [tailwindcss()] },
  // The art editor's and the bit lab's save endpoints, dev only, and the
  // /design-system page, which is built too.
  integrations: [artEditor(), bitLab(), designSystem()],
})
