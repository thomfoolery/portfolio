import eslintConfigPrettier from 'eslint-config-prettier'
import astro from 'eslint-plugin-astro'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

/**
 * Prettier owns formatting, so `eslint-config-prettier` turns off every rule that
 * would have an opinion about it. `pnpm lint` and `pnpm format` stay separate
 * jobs.
 */
export default defineConfig(
  { ignores: ['dist/**', '.astro/**', 'node_modules/**'] },

  astro.configs['flat/recommended'],

  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  {
    // The Astro preset leaves this off. Turning it on keeps the one `set:html`
    // in ArtHtml deliberate: anything that could carry input still gets flagged.
    rules: { 'astro/no-set-html-directive': 'warn' },
  },

  eslintConfigPrettier,
)
