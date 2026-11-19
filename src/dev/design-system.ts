import type { AstroIntegration } from 'astro'

/**
 * `/design-system`, a preview of the design system's tokens, which the footer
 * links to. It is built like the résumé, as `dist/design-system.html`, but
 * injected from here rather than living in `src/pages`: `src/dev` is not a
 * Tailwind source, so the page cannot grow the site's stylesheet.
 */
export function designSystem(): AstroIntegration {
  return {
    name: 'design-system',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        injectRoute({ pattern: '/design-system', entrypoint: './src/dev/design-system.astro' })
      },
    },
  }
}
