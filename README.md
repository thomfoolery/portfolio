# thomasyuill.com

A résumé, served as a terminal session on a 72-column grid.

Astro and Tailwind are build-time tools here. The page is prerendered to static
HTML. The JavaScript it ships is two handlers inlined at build time, about 1.4 KB
between them — the nav hotkeys and the "show more" buttons — plus three modules,
about 7 KB gzipped: Motion's `scroll()`, which scrubs every reveal, its spring,
which opens and closes a job, and the caret, which is small enough that the build
inlines it into the page.

## Commands

| command                 | what it does                                       |
| ----------------------- | -------------------------------------------------- |
| `pnpm dev`              | dev server on 4321, the page rendered on demand    |
| `pnpm dev-localnetwork` | same, backgrounded, host `zerocool` on the tailnet |
| `pnpm build`            | prerenders the page into `dist/`                   |
| `pnpm typecheck`        | `astro check`                                      |
| `pnpm lint`             | ESLint, type-aware, with eslint-plugin-astro       |
| `pnpm format`           | Prettier, in place. `format:check` verifies        |
| `pnpm preview`          | serves `dist/` on 4321                             |

`pnpm build` is the whole build: Astro renders the page and writes `dist/index.html`
with its hashed stylesheet.

## Deploy

Serve `dist/`. It is flat HTML plus its hashed assets:

```
dist/index.html                 the résumé, block art, job entries collapsible
dist/_astro/*.css               the hashed stylesheet
dist/_astro/*.js                the reveals and the disclosures, the only scripts
                                the page requests
dist/_astro/*.woff2             the hashed Commit Mono subset
```

Nothing in `dist/` needs a server-side runtime, a rewrite rule, or a CDN.

## Layout

```
eslint.config.ts    type-aware lint; formatting is left to Prettier
astro.config.mjs    the build, plus the dev-only art-editor and bit-lab integrations
.prettierrc.json    single quotes, no semicolons, 100 columns
src/
  components/       the shell: Section, Nav, Header, Footer, ArtHtml
    bit-lab/        the dev-only panel that tunes the stray bit
    honors/         HonorsList
    jobs/           JobsList and the job rows
    ui/             Link, Hint, Disclosure, Toggle — what the theme used to style
    Welcome.astro   the introduction
    Posts.astro     the posts list, not yet on the page
  data/             nav.ts, jobs.ts, honors.ts, posts.ts, grid.ts, bit.json
    art/            the ASCII art, as character and colour arrays
  dev/              art-editor.ts and bit-lab.ts, which write art and the bit's
                    settings back under `astro dev`
  fonts/            the Commit Mono subset, with its OFL licence
  layouts/          Base.astro, the document shell
  lib/              art.ts, bit.ts (the bit's settings and flight plan),
                    utils.ts (`cn`)
  pages/            index.astro, the one page
  scripts/          hotkeys.js and show-more.js, inlined at build time;
                    scroll-reveal.ts, disclosure.ts, cursor.ts and bit.ts, the
                    modules that ship
  styles/           main.css: the theme, and the one rule a utility cannot state
```

## Typography

The page draws one typeface, and it ships it: **Commit Mono** (OFL 1.1, notice in
`src/fonts/CommitMono-OFL.txt`), subset to the characters the page draws:
printable ASCII, `©`, the block glyphs the art is built from, and the handful the
dev-only editor paints with.
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
  --unicodes='U+0020-007E,U+00A9,U+00B7,U+00D7,U+2580,U+2584,U+2588,U+258C,U+2590,U+2591,U+2592,U+2593' \
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
still fit a narrow viewport, and `<p>` takes `leading-[2]`, a step looser than
the terminal line.

**Everything else is markup.** The weights, the link lightbar and the prose
rhythm are utilities on the elements that want them, so `main.css` holds the
theme, the face, and the body font-size — the one rule that cannot be a utility,
because the type scale is the column count. What genuinely needs CSS lives with
the component that needs it: `ui/Link.astro`, `ui/Hint.astro`,
`ui/Disclosure.astro` and `ui/Toggle.astro`.

**The one dependency with a client.** Two modules import `motion`, for two
things. `scripts/scroll-reveal.ts` takes `scroll()`: it reports how far an
element has travelled, and the script scrubs a paused animation with
`currentTime` — a width reveal, which types a line out, or a fade.
`scripts/disclosure.ts` takes `spring()` and nothing else: it asks for the curve
and samples it into the `linear()` easing a browser animation runs, so a job
opens on a critically damped spring (`bounce: 0`, no overshoot) and its content
fades over the same curve. Under `prefers-reduced-motion` the panel arrives at
its full height and only the fade runs, 150ms of it: the state change survives,
the travel does not. Jobs pass `openOnHover`: there a pointer resting on a
row for 250 ms opens it — long enough that crossing the list opens nothing — and
leaving closes it, while a click is ignored (Enter and Space still toggle it).
That only applies where a pointer can rest, so a touch screen keeps the click.
An opening row also plays its line's reveal out, so a heading the scroll had only
half drawn opens whole. When the close finishes the line travels back to wherever
the scroll has got to meanwhile, over the span it had played, rather than
snapping there. In both, animating and interpolating stay the
browser's work, so no easing is reimplemented. The two chunks are about 6.5 KB
gzipped together, and are the page's only script requests besides the stylesheet
and the font.

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

**The pointer is a caret.** `ui/Cursor.astro` draws the pointer as the terminal's
own block: one column wide, phosphor, `mix-blend-mode: exclusion` so a glyph it
covers flips dark the way a block cursor flips the character under it. It blinks
while still and holds solid while moving, both of which stop under
`prefers-reduced-motion`. It only arms for a fine pointer, and the native cursor
is only hidden once the script has run — a touch screen keeps its own.

**A stray bit crosses now and then.** `ui/Bit.astro` flies a filled square
across what is on screen, behind the text. It glides only up, down, left or
right, turning at right angles, with a fading trail: the same keyframes played
by dimmer followers a few ms apart. It is placed on the page, not the viewport,
so a scroll carries it off. Its layer clips and is zero tall between trips, so it
never changes the page's size. Like the caret, it only flies for a mouse or a
pen, and not in a hidden tab or under `prefers-reduced-motion`. Its trail is
made at launch and removed when the trip lands.

Its size, colours, trail, speed, timing and turns are `src/data/bit.json`, and a
flight is a pure function of those settings, a seed and the screen
(`lib/bit.ts`). Under `pnpm dev` the **[bit]** button opens a lab over the page:
every setting is a slider, a change replays the current seed, `fly` draws a new
one, and `save` writes `bit.json` — the file the page ships with.

**The page is a stack of panels.** `Section.astro` wraps the header, each
section and the footer: each panel is at least one viewport tall and centres its
content, except the footer, which aligns to the end. It renders the element it
is asked for, so the header stays a `<header>` and the footer a `<footer>`.

**One thing stays hand-written.** The `[+]/[-]` disclosure markers are a rule in
`ui/Toggle.astro`, because Tailwind cannot express generated content and should
not try.

**The art is content.** Each block in `src/data/art/` is two arrays — characters
and colours — rendered to markup at build time and injected through a
`display: contents` wrapper, so it does not become a component and costs no extra
layout.

**Two whitespace rules worth knowing.** The template compiler condenses runs of
whitespace and drops leading or trailing whitespace inside an element, and this
layout is a character grid. Significant spaces are interpolated from `GAP` and
`SPACE` in `src/data/grid.ts`, and the job heading row is kept on one line.

One element also carries a `prettier-ignore` for the same reason: Prettier's Astro
printer reflows inline runs onto separate lines, which turns those spaces into
newlines for the compiler to drop. Write the directive alone in its comment —
Prettier matches the text exactly, so `prettier-ignore: why` is silently ignored and
the row is reflowed anyway.

Use the JSX form, `{/* prettier-ignore */}`. The HTML form works for Prettier too,
but Astro emits it into the page as a comment.

**The art goes through one component.** `ArtHtml` injects the `src/data/art`
fragments and holds the single exemption from `astro/no-set-html-directive`, with its reason. The
rule stays armed everywhere else, so a `set:html` on anything that could carry input
is still flagged.
