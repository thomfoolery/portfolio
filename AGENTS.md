# portfolio — thomasyuill.com

Overrides `../AGENTS.md`. Anything not named here still applies.

## Stack: Astro + Tailwind 4, prerendered

Not React Router. See [README.md](README.md) for how the build fits together.

The page's own comment calls it a "super-low bandwidth tribute": the build exists
to remove duplication within the résumé, not to ship a framework. So:

- `pnpm build` writes flat HTML to `dist/`. Astro runs at build time only.
  The output has no framework and makes no external requests.
- The page ships one inlined `<script>` (`src/hotkeys.js`), because the nav
  hotkeys need it.
- Serve `dist/`. The URL is `/index.html`.
- A new client dependency, or anything that grows the shipped JS, has to be
  justified against that.

## The layout is a character grid, not a pixel grid

Every length is a character cell or a terminal line.

- `--spacing` is one line (1.6em), so `mt-3` is three lines, `gap-6` is six.
  Widths are `w-[72ch]`, indents `ml-[11ch]`, art rows `mt-art` / `pt-art-2`.
- Do not snap these to Tailwind's rem scale. If a value is in `px` or `rem`,
  say why in a comment. The 12px page gutter, the nav's 1rem lift, the header's
  −1.5rem pull and the `100dvh` screen rhythm are the deliberate ones.
- `src/styles/main.css` is the theme, base and components. Keep the `[+]/[-]`
  markers hand-written — Tailwind cannot express them.

## Three traps that have already bitten

1. **Whitespace is data here.** The template compiler condenses runs of
   whitespace and drops leading or trailing whitespace inside an element. In a
   `white-space: pre` row that silently eats spaces, and the rows are the design.
   Use `GAP` / `SPACE` from `src/data/frame.ts` and keep such a row on one
   source line. See `JobHeading.astro`.
2. **Preflight is border-box.** A padded `w-[72ch]` frame comes out 24px narrow
   and the art gets clipped. The gutter lives on `body`, not on the frame.
3. **Prettier would reflow the grid.** Its Astro printer breaks inline runs onto
   separate lines, which turns those significant spaces into newlines for the
   compiler to drop. Six elements therefore carry `<!-- prettier-ignore -->`,
   with the reason in the comment above. Write the directive alone in its
   comment: Prettier matches the text exactly, so `<!-- prettier-ignore: why -->`
   is silently ignored and the row is reflowed anyway. After any `pnpm format`,
   the guards are what keep the design still — check them before trusting it.

## Verify against the previous output, do not eyeball it

A refactor here means the same pixels. Compare old and new at real layout: the
bounding box of every non-whitespace text node (`Range.selectNodeContents` then
`getBoundingClientRect`), plus `scrollHeight` and `scrollWidth`, plus a screenshot
diff of the region with `magick compare -metric AE`.

Serve both trees from one origin and read them through iframes. Layout only
exists in a live document, and cross-origin fetch is blocked, so this is the
cheapest way to get both versions measured at once. Report what was checked and
what was not.

## Checks

`pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm build` all pass on
`HEAD`. Lint is type-aware, and Prettier owns formatting: ESLint is configured
with `skip-formatting`, so the two do not overlap. Run `pnpm lint` and
`pnpm format` before committing.

`pnpm test:e2e` from the parent file does not exist here. Adding Playwright is a
dependency decision: ask first.

`typescript-eslint` refuses to load on TypeScript 7 and above. This project is on
5.9, and `typescript` must not be bumped past 6.x until that is supported.

## Conventions

- The ASCII art is content, not structure. Fragments in `src/data/art/`,
  injected through `ArtHtml`, which owns the one `astro/no-set-html-directive`
  exemption. Do not componentize the art itself, and do not add a second
  `set:html` elsewhere:
  the rule is deliberately still armed for anything that could carry input.
- The résumé's content lives in `src/data/` as data (`nav`, `jobs`, `posts`,
  `honors`). Edit the data, not the markup.
- The site is one page, `src/pages/index.astro`, built from `src/components/`.
  Its structure belongs in `ResumeFrame.astro`; the page supplies only the art
  and the welcome copy. Job entries are collapsible `<details>`.
