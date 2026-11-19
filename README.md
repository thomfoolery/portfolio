# thomasyuill.com

A résumé, served as a terminal session on a 72-column grid.

Astro and Tailwind are build-time tools here. The page is prerendered to static
HTML. The JavaScript it ships is the nav hotkeys, inlined at build time, plus a
few modules, about 9 KB gzipped in all: Motion's `scrollInfo()`, which scrubs
every reveal and is the one script the page requests; and the disclosures, the
"show more" lists, the caret, the stray bit, the art's glitch and the Work
carousel's loops, which are small enough that the build inlines them into the
page. The spring the disclosures and lists open on is worked out at build time,
so its solver never ships.

The heavy part is the Work carousel. Each tile is its poster in the page's
green: a WebP made at build time in the poster's own shape, so a portrait loop
makes a narrow tile, and drawn without smoothing. A tile is a button: clicking
it zooms the poster to fill the screen, two lines in from every edge, and once it
lands and the loop has a picture, the loop fades in over it in its own colour.
That is the only time a loop is fetched or plays. A click anywhere, Esc or Tab
fades it back to the poster, then zooms it back. The tile's own video moves into
an overlay, so nothing is fetched twice; under reduced motion the zoom is instant.
Under the carousel, `[ << ]` and `[ >> ]` step it to the neighbouring
tile's snap, and dim at either end rather than disable, so keyboard focus stays
put. Without scripts they are hidden, with the other buttons.

## Commands

| command                 | what it does                                       |
| ----------------------- | -------------------------------------------------- |
| `pnpm dev`              | dev server on 4321, the page rendered on demand    |
| `pnpm dev-localnetwork` | same, backgrounded, host `zerocool` on the tailnet |
| `pnpm build`            | prerenders the page into `dist/`                   |
| `pnpm typecheck`        | `astro check`                                      |
| `pnpm lint`             | ESLint, type-aware, with eslint-plugin-astro       |
| `pnpm format`           | oxfmt, in place. `format:check` verifies           |
| `pnpm preview`          | serves `dist/` on 4321                             |
| `pnpm github`           | refreshes `src/data/github.json` from GitHub       |

`/design-system` previews the design system: every colour token, with its
contrast on black, and the face, its weights, sizes and leading, all read from
`src/styles/main.css`. The footer links to it.

`pnpm build` is the whole build: Astro renders the résumé and `/design-system`
and writes `dist/index.html` and `dist/design-system.html` with their hashed
stylesheet. The GitHub table reads a committed snapshot, `src/data/github.json`,
so the build never touches the network; `pnpm github` refreshes it, and the
change is committed like any other.

## Deploy

Serve `dist/`. It is flat HTML plus its hashed assets:

```
dist/index.html                 the résumé, block art, job entries collapsible
dist/design-system.html         the design system's tokens, linked from the footer
dist/_astro/*.css               the hashed stylesheet
dist/_astro/*.js                the reveals: the only script the page requests
dist/_astro/*.woff2             the hashed Ioskeley Mono subsets, one per weight
dist/_astro/*.{webp,mp4,webm}   the Work carousel's posters and loops
```

Nothing in `dist/` needs a server-side runtime, a rewrite rule, or a CDN.

## Layout

```
eslint.config.ts    type-aware lint; formatting is left to oxfmt
astro.config.mjs    the build and `/design-system`, plus the dev-only art editor
                    and bit lab
.oxfmtrc.json       single quotes, no semicolons, 100 columns, Tailwind classes sorted
src/
  assets/work/      the Work carousel's stills and loops, as uploaded
  components/       the shell and the sections: Section, Nav, Header, WhoAmI,
                    Experience, Work, Certifications, Footer; ArtHtml, which
                    draws the art
    art-editor/     the dev-only art editor
    bit-lab/        the dev-only panel that tunes the stray bit
    jobs/           a job's row: its heading, its roles and their dotted rows
    ui/             Link, Hint, Disclosure, Toggle, Button — what the theme used
                    to style; Table, Tr and Td, the box-drawn tables; Prompt,
                    ShowMore, Cursor and Bit
    Posts.astro     the posts list, not yet on the page
  data/             nav.ts, jobs.ts, honors.ts, recommendations.ts, posts.ts,
                    work.ts, grid.ts, bit.json, github.json
    art/            the ASCII art, as character and colour arrays
  dev/              art-editor.ts and bit-lab.ts, which write art and the bit's
                    settings back under `astro dev`; design-system.ts and
                    .astro, the `/design-system` page of tokens, built with
                    the résumé; github.ts, which `pnpm github` runs to write
                    data/github.json. Not a Tailwind source
  fonts/            the Ioskeley Mono subsets, with their OFL licence
  layouts/          Base.astro, the document shell
  lib/              art.ts, bit.ts (the bit's settings and flight plan),
                    ascii-table.ts (lays out a Table), html.ts (decodes the
                    entities both read), spring.ts (the page's no-bounce
                    spring, at build time), utils.ts (`cn`)
  pages/            index.astro, the résumé (`/design-system` is injected from
                    `dev/`)
  scripts/          hotkeys.js, inlined at build time; scroll-reveal.ts,
                    disclosure.ts, show-more.ts, cursor.ts, bit.ts, glitch.ts
                    and work.ts, the modules that ship
  styles/           main.css: the theme, and the one rule a utility cannot state
```

## Typography

The page draws one typeface, and it ships it: **Ioskeley Mono** (OFL 1.1, notice in
`src/fonts/IoskeleyMono-OFL.txt`), an Iosevka build by Ahmed Hatem, subset to the
characters the page draws: printable ASCII, `©`, the block glyphs the art is built
from, and the handful the dev-only editor paints with.
It ships one static file per weight, about 10KB each: prose and art 300, the
body's own weight, the nav's button-links 600, headlines 700, and the rest where
markup or the art editor asks (200, 400, 500, 900). A browser fetches only the
weights it draws, and Base.astro preloads the two in the first viewport: 300
and 600. Art rows are `leading-tight`, 1.25: the height of the font's full block,
so rows of `█` meet with no seam and no overlap.
`➚` is the one character the font has no glyph for, so that prose marker falls
back to a system face.

The subsets are committed, so a build needs no font tooling. To regenerate them
after a version bump — `pyftsubset` in a throwaway venv, never a project
dependency:

```sh
python3 -m venv /tmp/venv && /tmp/venv/bin/pip install fonttools brotli

curl -LO https://github.com/ahatem/IoskeleyMono/releases/latest/download/IoskeleyMono-Web.zip
unzip IoskeleyMono-Web.zip -d /tmp/ioskeley
for w in ExtraLight Light Regular Medium SemiBold Bold Black; do
  /tmp/venv/bin/pyftsubset /tmp/ioskeley/WOFF2/IoskeleyMono-$w.woff2 --flavor=woff2 --layout-features='' \
    --unicodes='U+0020-007E,U+00A9,U+00B7,U+00D7,U+00E9,U+2500,U+2502,U+250C,U+2510,U+2514,U+2518,U+251C,U+2524,U+252C,U+2534,U+253C,U+2580,U+2584,U+2588,U+258C,U+2590,U+2591,U+2592,U+2593' \
    --output-file=src/fonts/ioskeley-mono-$(echo $w | tr A-Z a-z)-subset.woff2
done
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
still fit a narrow viewport, but never below 12px: under the `wide` breakpoint
(546px, where the two part) the text reflows, nothing reveals on scroll, and
only the art, sized by `--art-size`, keeps shrinking to hold 72 columns. `<p>`
takes `leading-loose`, a step looser than the terminal line.

**Everything else is markup.** The weights, the link lightbar and the prose
rhythm are utilities on the elements that want them, so `main.css` holds the
theme, the face, and the body font-size — the one rule that cannot be a utility,
because the type scale is the column count. What genuinely needs CSS lives with
the component that needs it: `ui/Link.astro`, `ui/Hint.astro`,
`ui/Disclosure.astro` and `ui/Toggle.astro`. `ui/Button.astro` is the "[ show
more ]" button: full phosphor, filled with Link's lightbar on hover, focus and
press.

**The one dependency with a client.** Two modules import `motion`, for two
things. `scripts/scroll-reveal.ts` takes `scrollInfo()`: it reports how far an
element has travelled, and the script scrubs a paused animation with
`currentTime` — a width reveal, which types a line out, or a fade.
`lib/spring.ts` takes `spring()` and nothing else, at build time: it asks for the
curve and samples it into the `linear()` easing a browser animation runs,
critically damped (`bounce: 0`, no overshoot). `ui/Disclosure` and `ui/ShowMore`
work their curves out with it and hand them to their scripts on an element, so
only the numbers ship. `scripts/disclosure.ts` opens a job on it, and its
content fades over the same curve. Under `prefers-reduced-motion` the panel arrives at
its full height and only the fade runs, 150ms of it: the state change survives,
the travel does not. A row opens and closes on a click, or on Enter or Space.
An opening row also plays its line's reveal out, so a heading the scroll had only
half drawn opens whole. When the close finishes the line travels back to wherever
the scroll has got to meanwhile, over the span it had played, rather than
snapping there. In both, animating and interpolating stay the
browser's work, so no easing is reimplemented. The reveal chunk is about 4 KB
gzipped, and the page's only script request besides the stylesheet and the
font; the rest is inline.

**Markup carries the reveal.** An element opts in with `data-reveal`, and names
its animation with `data-reveal="fade"` when it is not the default width reveal.
`data-reveal-range="50% 20%"` takes the CSS `view()` range it used to be written
with, so the scroll positions stayed the same when the timelines moved out of
CSS.

**Nothing flashes on the way in.** The state before the script arrives is CSS in
`Base.astro`: a reveal starts at zero width or zero opacity, and the folded rows
carry `data-folded`, which is a rule rather than the `hidden` attribute because
preflight's `[hidden] { display: none !important }` sits in a layer and would win.
A `<noscript>` in the same file undoes both, so a reader without scripts gets
every line, every row, and no buttons. The same file listens for a script that
fails to load and shows the page rather than a blank one.

**Rows can enter on a click instead.** The "show more" rows were already past the
scroll that would have revealed them, so each fires `reveal:enter` with its place
in the stagger. The entrance is its own animation, played in turn and cancelled
the moment it lands; while it runs the scroll is not allowed to touch the row, so
a scroll cannot cut it short. Then the scroll owns the element again: the row
holds at full until the scroll catches up with it, and from there it is scrubbed
like its neighbours — scroll back and it runs in reverse again. The two scripts
do not import each other: one asks in an event, the other owns the animations.
The list itself springs open (`scripts/show-more.ts`), on the same no-bounce
spring as a job, from the height that keeps whatever follows it in place, so the
button going and the rows arriving are one movement. Under
`prefers-reduced-motion` the rows are simply there.

**The art loses sync, but only while the page moves.** Glitches come from scroll
events, not a timer (`scripts/glitch.ts`): the first scroll of a burst glitches
within a few frames, then one every 60 to 190 ms for as long as the page keeps
moving — now a band of one illustration, a row or three tall, jumping sideways by
one to three character cells, now single cells flickering, inverted or knocked out,
several at a time. Nothing happens when the page is still, nothing is touched on a
block that is off screen, and none of it under `prefers-reduced-motion` or in a
hidden tab. The band is a ghost copy of the art that the script clones when it
first glitches a block: a copy in the markup would double the art's bytes, and
moving the rows themselves is impossible without giving each a box, which stops the
block glyphs abutting and opens hairline seams. Only the hero and the blocks that
reveal on scroll take part.

The header's art is the exception. It is marked `glitch="loop"` and glitches on
its own, page moving or not: runs of two to five glitches at the same pace, with
0.8 to 2.5 s of quiet between them, and the scroll leaves it alone. The same
rules hold: off screen, in a hidden tab, or under reduced motion its timer
stops altogether, and coming back starts it again with a quiet gap.

**The pointer is a caret.** `ui/Cursor.astro` draws the pointer as the terminal's
own block: one column wide, phosphor, `mix-blend-mode: exclusion` so a glyph it
covers flips dark the way a block cursor flips the character under it. It blinks
while still and holds solid while moving, both of which stop under
`prefers-reduced-motion`. It only arms for a fine pointer, and the native cursor
is only hidden once the script has run — a touch screen keeps its own.

**A stray bit crosses now and then.** `ui/Bit.astro` flies a filled square
across what is on screen, behind the text. It glides only up, down, left or
right, turning at right angles, and leaves a fading trail that nothing draws:
on a canvas the size of the screen, every frame dims what is there and draws the
bit where it is now, stretched back through any corner to where it was the frame
before, so the line is unbroken at any speed. The canvas is pinned to the page
where the trip starts, so a scroll carries it off, and it is hidden between
trips. Like the caret, it only flies for a mouse or a pen, and not in a hidden
tab or under `prefers-reduced-motion`.

Its size, colours, fade, speed, timing and turns are `src/data/bit.json`, and a
flight is a pure function of those settings, a seed and the screen
(`lib/bit.ts`). Under `pnpm dev` the **[bit]** button opens a lab over the page:
every setting is a slider, a change replays the current seed, `fly` draws a new
one, and `save` writes `bit.json` — the file the page ships with.

**The page is a stack of panels.** `Section.astro` wraps the header, each
section and the footer, each its own centred 72-column frame. It renders the
element it is asked for, so the header stays a `<header>` and the footer a
`<footer>`. The space between panels is each one's own top margin.

**One thing stays hand-written.** The `[+]/[-]` disclosure markers are a rule in
`ui/Toggle.astro`, because Tailwind cannot express generated content and should
not try.

**The art is content.** Each block in `src/data/art/` is two arrays — characters
and colours — rendered to markup at build time and injected by `ArtHtml` into
one wrapper, which carries the block's classes, its reveal and its glitch, so the
art itself never becomes components.

**Two whitespace rules worth knowing.** The template compiler condenses runs of
whitespace and drops leading or trailing whitespace inside an element, and this
layout is a character grid. Significant spaces are interpolated from `GAP` and
`SPACE` in `src/data/grid.ts`, and the job heading row is kept on one line.

Two elements also carry a `prettier-ignore` for the same reason, the rows in
`ui/Table` and `jobs/LeaderRow`: oxfmt formats `.astro` with Prettier's Astro
printer, which reflows inline runs onto separate lines, and that turns those
spaces into newlines for the compiler to drop. `prettier-ignore` is the directive
Astro markup reads; `oxfmt-ignore` is not. Write it alone in its comment — it
matches the text exactly, so `prettier-ignore: why` is silently ignored and the
row is reflowed anyway.

Use the JSX form, `{/* prettier-ignore */}`. The HTML form works too, but Astro
emits it into the page as a comment.

**The art goes through one component.** `ArtHtml` injects the `src/data/art`
fragments and holds the single exemption from `astro/no-set-html-directive`, with its reason. The
rule stays armed everywhere else, so a `set:html` on anything that could carry input
is still flagged.
