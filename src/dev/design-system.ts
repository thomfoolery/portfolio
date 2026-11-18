import type { AstroIntegration } from 'astro'

/**
 * `/ds`, a preview of the design system's tokens. The route is injected for
 * `astro dev` only — the hook skips a build — so the deployed site stays one
 * page, and `dist/` has no `/ds`.
 */
export function designSystem(): AstroIntegration {
  return {
    name: 'design-system',
    hooks: {
      'astro:config:setup': ({ command, injectRoute }) => {
        if (command === 'dev')
          injectRoute({ pattern: '/ds', entrypoint: './src/dev/design-system.astro' })
      },
    },
  }
}
