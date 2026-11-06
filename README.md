# thomasyuill.com

A résumé, served as a terminal session on a 72-column grid.

Astro and Tailwind are build-time tools here. The page is prerendered to static
HTML. The only JavaScript it ships is the inlined nav hotkey handler, about 560
bytes.

## Commands

| command          | what it does                                    |
| ---------------- | ----------------------------------------------- |
| `pnpm dev`       | dev server on 4321, the page rendered on demand |
| `pnpm build`     | prerenders the page into `dist/`                |
| `pnpm typecheck` | `astro check`                                   |
| `pnpm lint`      | ESLint, type-aware, with eslint-plugin-astro    |
| `pnpm format`    | Prettier, in place. `format:check` verifies     |
| `pnpm preview`   | serves `dist/` on 4321                          |

`pnpm build` is the whole build: Astro renders the page and writes `dist/index.html`
with its hashed stylesheet.

## Deploy

Serve `dist/`. It is flat HTML plus one hashed stylesheet:

```
dist/index.html      the résumé, block art, job entries collapsible
dist/_astro/*.css    the hashed stylesheet
```

Nothing in `dist/` needs a server-side runtime, a rewrite rule, or a CDN.

## Layout

```
eslint.config.ts    type-aware lint; formatting is left to Prettier
.prettierrc.json    single quotes, no semicolons, 100 columns
src/
  components/       the shell: Section, Nav, SiteFooter, ArtHtml
    jobs/           JobsList, the job rows and jobs.ts
    posts/          PostsList and posts.ts
    honors/         HonorsList and honors.ts
    hotkeys.js      the nav's script, inlined into the page at build time
  data/             nav.ts, grid.ts and the art
    art/            the ASCII art, as .html fragments (30-45% of the page)
  layouts/          Base.astro, the document shell
  pages/            index.astro, the one page
  styles/           main.css (Tailwind theme, base and components)
```

## How it fits together

**The theme is the design system.** `src/styles/main.css` declares the phosphor
ramp, and sets `--spacing` to one terminal line so `mt-3` is three lines rather
than three-quarters of a rem. Lengths in this layout are character cells and
lines, so `w-[72ch]` and `ml-[11ch]` are written out as arbitrary values rather
than snapped to a pixel scale. Body text is 16px, clamped down so 72 columns
still fit a narrow viewport, and `<p>` runs at a 1.7 line-height.

**The page is a stack of panels.** `Section.astro` wraps the header, each
section and the footer: each panel is at least one viewport tall and centres its
content, except the footer, which aligns to the end. It renders the element it
is asked for, so the header stays a `<header>` and the footer a `<footer>`.

**One thing stays hand-written.** The `[+]/[-]` disclosure markers are in plain
CSS, because Tailwind cannot express them and should not try.

**The art is content.** It is injected from `src/data/art/*.html` through a
`display: contents` wrapper, so it does not become a component and costs no
extra layout.

**Two whitespace rules worth knowing.** The template compiler condenses runs of
whitespace and drops leading or trailing whitespace inside an element, and this
layout is a character grid. Significant spaces are interpolated from `GAP` and
`SPACE` in `src/data/grid.ts`, and the job heading row is kept on one line.

Seven elements also carry a `prettier-ignore` for the same reason: Prettier's Astro
printer reflows inline runs onto separate lines, which turns those spaces into
newlines for the compiler to drop. Write the directive alone in its comment —
Prettier matches the text exactly, so `prettier-ignore: why` is silently ignored and
the row is reflowed anyway.

Use the JSX form, `{/* prettier-ignore */}`. The HTML form works for Prettier too,
but Astro emits it into the page: six of the seven guards currently ship as
comments.

**The art goes through one component.** `ArtHtml` injects the `src/data/art`
fragments and holds the single exemption from `astro/no-set-html-directive`, with its reason. The
rule stays armed everywhere else, so a `set:html` on anything that could carry input
is still flagged.
