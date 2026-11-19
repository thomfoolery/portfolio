# portfolio — thomasyuill.com

Overrides `../AGENTS.md`. Anything not named here still applies.

## Stack: Astro + Tailwind 4, prerendered

Not React Router. See [README.md](README.md) for how the build fits together.

The page's own comment calls it a "super-low bandwidth tribute": the build exists
to remove duplication within the résumé, not to ship a framework. So:

- `pnpm build` writes flat HTML to `dist/`. Astro runs at build time only.
  The output has no framework and makes no external requests.
- The page ships one inlined `<script>`, `src/scripts/hotkeys.js`, because the
  nav hotkeys need it, plus the modules in `src/scripts/`: `scroll-reveal.ts`,
  `disclosure.ts`, `show-more.ts`, `cursor.ts`, `bit.ts`, `glitch.ts` and
  `work.ts`. The build inlines a small one without imports; the rest are chunks
  in `_astro/`, and today that is only `scroll-reveal.ts`. A module two scripts share becomes
  a chunk of its own and stops both being inlined.
  `scroll-reveal.ts` and `lib/spring.ts` are the only files that import
  `motion`, and every spring on the page comes from `lib/spring`, which runs at
  build time only: a component works the curve out and hands it to its script
  on an element (`ui/Disclosure`, `ui/ShowMore`). Import it from a component,
  never from a script.
- Serve `dist/`. The URL is `/index.html`.
- A new client dependency, or anything that grows the shipped JS, has to be
  justified against that.

## The layout is a character grid, not a pixel grid

Every length is a character cell or a terminal line.

- `--spacing` is one line (1.6em), so `mt-3` is three lines, `gap-6` is six.
  Widths are `w-[72ch]` and indents `ml-[11ch]`.
- Body text is 16px, clamped down so 72 columns still fit a narrow viewport,
  down to 12px. Below that (`max-wide:`, 546px) only the art (`--art-size`)
  holds the 72-column grid: text reflows, rows stack, and reveals are off.
  Anything with a fixed `ch` width needs a `max-wide:` answer.
  `<p>` states `leading-loose` of its own; everything else inherits the terminal
  line (1.6em).
- Every panel is a `Section.astro`, which renders the element it is given via
  `as`, so the header, the sections and the footer share one frame. The space
  between panels is each one's own top margin.
- Do not snap these to Tailwind's rem scale. If a value is in `px` or `rem`,
  say why in a comment. The 12px page gutter is the deliberate one.
- `src/styles/main.css` is the theme, plus the one body rule a utility cannot
  state. Everything else is a utility on the element, or scoped CSS in the
  component that needs it (`ui/Link`, `ui/Hint`, `ui/Disclosure`, `ui/Toggle`,
  `Work`).
  Keep the `[+]/[-]` markers hand-written — Tailwind cannot express them.

## Three traps that have already bitten

1. **Whitespace is data here.** The template compiler condenses runs of
   whitespace and drops leading or trailing whitespace inside an element. In a
   `white-space: pre` row that silently eats spaces, and the rows are the design.
   Use `GAP` / `SPACE` from `src/data/grid.ts` and keep such a row on one
   source line. See `JobHeading.astro`.
2. **Preflight is border-box.** A padded `w-[72ch]` frame comes out 24px narrow
   and the art gets clipped. The gutter lives on `body`, not on the frames.
3. **The formatter would reflow the grid.** oxfmt formats `.astro` with
   Prettier's Astro printer, bundled, which breaks inline runs onto separate
   lines and turns those significant spaces into newlines for the compiler to
   drop. Such a row carries a `prettier-ignore`, with the reason in the comment
   above: that is the directive Astro markup reads, and `oxfmt-ignore` is not.
   Write it alone in its comment: it matches the text exactly, so
   `prettier-ignore: why` is silently ignored and the row is reflowed anyway.
   After any `pnpm format`, the guards are what keep the design still — check
   them before trusting it.
   Use the JSX form, `{/* prettier-ignore */}`. The HTML form works too, but
   Astro emits it into the page, so it ships a comment per use.

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
`HEAD`. Lint is type-aware, and oxfmt owns formatting: ESLint is configured
with `eslint-config-prettier`, which turns its formatting rules off for any
formatter, so the two do not overlap. Run `pnpm lint` and `pnpm format` before
committing.

oxfmt also sorts Tailwind classes, in `class`, `class:list` and `cn()`, reading
the theme and the custom variants from `src/styles/main.css` (`.oxfmtrc.json`).
A class string held in a constant is not sorted. oxfmt is pinned to an exact
version, since a 0.x release can change its output.

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
- The résumé's data lives in `src/data/` — `jobs.ts`, `honors.ts`,
  `recommendations.ts`, `posts.ts`, `work.ts`, `nav.ts`, `grid.ts`, the art. Edit
  the data, not the markup.
- The Work carousel's media lives in `src/assets/work/`, not a public folder:
  `data/work.ts` imports it, so the build hashes it, and the poster is made a
  WebP there (`getImage`). A loop stays `preload="none"` and plays only
  enlarged, through `scripts/work.ts`, so it costs nothing until it is clicked.
  The enlarged view is an overlay on `--z-zoom`, not a `<dialog>`: a modal is
  drawn in the top layer, over the caret, and the page hides the system pointer.
  The tile's own frame, video and all, moves into it rather than a copy, which
  would fetch again.
- `src/data/github.json` is a snapshot, not hand-edited: `pnpm github` rewrites
  it from GitHub's public API. The build reads the file, never the network.
- The stray bit is tuned, not hand-edited: `src/data/bit.json` holds every
  setting, and the dev-only lab (`[bit]` under `pnpm dev`) writes it. Flights
  come from `plan()` in `lib/bit.ts`, which must stay pure — same settings,
  seed and screen, same path — or the lab's replay and save stop meaning anything.
- `/ds` previews the design system under `pnpm dev` only
  (`dev/design-system.astro`), reading every token from `main.css` rather than
  listing it again. `src/dev` is not a Tailwind source, so nothing there can grow
  the shipped stylesheet — and a utility used only there gets no rule: style
  such a page with scoped CSS.
- The site is one page, `src/pages/index.astro`, built from `src/components/`.
  The page holds the structure — the header panel, the nav, the sections in
  order, the footer — and each takes its fragments from `blockArt`. There is
  no page-wide wrapper: each panel (`Section.astro`) and the nav is its own
  centred `w-[72ch]` frame. The nav is docked to the bottom of the screen but
  stays second in the markup: the body is a flex column and the nav is
  `order-last`, so keyboard and screen-reader order are unchanged.
  `<WhoAmI />` is the introduction; job entries are collapsible `<details>`.
- The page is written as a terminal session: a command is a `ui/Prompt`, and a
  folded list ends in a `ui/ShowMore`. Do not write either by hand.
- Box-drawn tables are markup, written like an HTML table: `ui/Table`, `Tr` and
  `Td` (`heading`, `colSpan`). Never draw one by hand: `lib/ascii-table` does the
  borders and junctions, and fails the build when a row does not fill the grid.
  Cells are text: a link is markdown, `[text](href)`, drawn with `ui/Link`, so no
  cell's HTML is passed through and there is still only one `set:html`.
