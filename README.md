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
dist/index.html                 the résumé, block art, job entries collapsible
dist/_astro/*.css               the hashed stylesheet
dist/_astro/*.woff2             the hashed Commit Mono subset
```

Nothing in `dist/` needs a server-side runtime, a rewrite rule, or a CDN.

## Layout

```
eslint.config.ts    type-aware lint; formatting is left to Prettier
.prettierrc.json    single quotes, no semicolons, 100 columns
src/
  components/       the shell: Section, Nav, SiteFooter, ArtHtml
    jobs/           JobsList and the job rows
    posts/          PostsList and posts.ts
    honors/         HonorsList
    welcome/        Welcome, the introduction
    hotkeys.js      the nav's script, inlined into the page at build time
  data/             nav.ts, jobs.ts, honors.ts, grid.ts and the art
    art/            the ASCII art, as character and colour arrays
  fonts/            the Commit Mono subset, with its OFL licence
  layouts/          Base.astro, the document shell
  pages/            index.astro, the one page
  styles/           main.css (Tailwind theme, base and components)
```

## Typography

The page draws one typeface, and it ships it: **Commit Mono** (OFL 1.1, notice in
`src/fonts/CommitMono-OFL.txt`), subset to the 102 characters the page actually
contains — printable ASCII, `©`, and the six block glyphs the art is built from.
It is variable, `wght 200-700`, so the page's three roles take three weights:
prose 200, the terminal's own voice 300, headlines 700, and the nav's button-links 600. `➚` is the one character Commit Mono has no glyph for, so that prose marker
falls back to a system face.

The subset is committed, so a build needs no font tooling. To regenerate it after
a version bump — `pyftsubset` in a throwaway venv, never a project dependency:

```sh
python3 -m venv /tmp/venv && /tmp/venv/bin/pip install fonttools brotli

curl -O https://raw.githubusercontent.com/eigilnikolajsen/commit-mono/main/src/fonts/fontlab/CommitMonoV143-VF.ttf
/tmp/venv/bin/python -m fontTools.varLib.instancer CommitMonoV143-VF.ttf ital=0 --output /tmp/vf.ttf
/tmp/venv/bin/pyftsubset /tmp/vf.ttf --flavor=woff2 --layout-features='' \
  --unicodes='U+0020-007E,U+00A9,U+2580,U+2584,U+2588,U+2591,U+2592,U+2593' \
  --output-file=src/fonts/commit-mono-subset.woff2
```

`--layout-features=''` is load-bearing: a ligature in the art would reflow the
grid. Check any new subset the same way — every glyph it ships must advance
0.6000em, or 72 columns stop lining up.

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

**The art is content.** Each block in `src/data/art/` is two arrays — characters
and colours — rendered to markup at build time and injected through a
`display: contents` wrapper, so it does not become a component and costs no extra
layout.

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
