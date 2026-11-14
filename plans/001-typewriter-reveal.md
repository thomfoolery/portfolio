# 001 — Quantise the text reveal to character cells

- **Commit:** 843faac
- **Status:** DONE (see the hand-off at the end)
- **Severity:** MEDIUM
- **Category:** Easing & duration
- **Estimated scope:** 1 file, ~1 line

## Problem

Every text scroll-reveal is drawn on `ease`, a built-in curve that front-loads
hard: measured on a 720px line, `ease` has drawn **578px (80%)** by the time the
line's scroll range is half over, and **99px (14%)** by an eighth. So each line
appears almost at once and then sits still for the rest of its range — the
"telling" happens in the first third of the scroll and the remaining two thirds
show nothing changing.

The original CSS asked for a typewriter: `animation-timing-function: step(72, end)`,
one step per column of the 72-column grid. `step()` is not a CSS function, so the
declaration was dropped and the initial `ease` stood — the reveal has never been
what it was written to be. Audit rule: a built-in named curve on a deliberate
animation is too weak to carry it, and here the intended curve is known.

## Where

| File                           | Lines   | What's there                                                                      |
| ------------------------------ | ------- | --------------------------------------------------------------------------------- |
| `src/scripts/scroll-reveal.ts` | 29–32   | `KINDS`, the two reveal specs                                                     |
| `src/scripts/scroll-reveal.ts` | 84–93   | `bind()`, which animates with that spec                                           |
| `src/scripts/scroll-reveal.ts` | 210–216 | the `reveal:enter` entrance, which reuses the same spec                           |
| `src/scripts/scroll-reveal.ts` | 150–160 | `reveal.settle()`, the return to the scroll frame, which reuses `specs[0].easing` |

### Current code

```ts
// src/scripts/scroll-reveal.ts:29
const KINDS: Record<Kind, { keyframes: Keyframe[]; easing: string; props: string[] }[]> = {
  width: [{ keyframes: [{ width: '0' }, { width: '100%' }], easing: 'ease', props: ['width'] }],
  fade: [{ keyframes: [{ opacity: 0 }, { opacity: 1 }], easing: 'linear', props: ['opacity'] }],
}
```

## Target

```ts
// src/scripts/scroll-reveal.ts:29
const KINDS: Record<Kind, { keyframes: Keyframe[]; easing: string; props: string[] }[]> = {
  width: [
    { keyframes: [{ width: '0' }, { width: '100%' }], easing: 'steps(72, end)', props: ['width'] },
  ],
  fade: [{ keyframes: [{ opacity: 0 }, { opacity: 1 }], easing: 'linear', props: ['opacity'] }],
}
```

**Why these values:**

- `steps(72, end)` — the reveal is scrubbed by scroll, so the easing maps scroll
  progress to width. 72 steps of the width is one step per column of the grid, the
  quantisation the CSS asked for, and it makes progress **linear in cells**:
  measured, 12.5% of the range draws 90/720px and 50% draws 360/720px, i.e. the
  line types as you scroll instead of snapping in. `end` (not `start`) so a cell
  stays blank until its step begins, which is how a cursor types.
- No duration change. `DURATION = 1000` is the length of the _timeline_, and the
  scroll position drives it; 72 steps over it also means the one-shot entrance
  types a line in ~1s at 14ms per cell.
- `fade` stays `linear`. It is scrubbed by scroll too, so linear progress is
  correct for it — this plan deliberately does not touch it.

## Conventions to follow

- Reveal specs live only in `KINDS` in `src/scripts/scroll-reveal.ts`. Nothing
  else hardcodes a curve for the reveals; the entrance and the settle both read
  from this table, so one edit covers all three.
- The file's own house style: string easings inline in the spec, terse
  `//`-free doc comment above the table explaining _why_ the shape is what it is.
  Keep the existing comment's voice; extend the first paragraph rather than
  replacing it.
- `src/scripts/disclosure.ts` is the exemplar for documenting a chosen curve
  (it explains `bounce: 0` and the sampled spring); match that level of
  explanation in the comment.

## Steps

1. In `src/scripts/scroll-reveal.ts`, change the `width` spec's `easing` from
   `'ease'` to `'steps(72, end)'`.
2. Update the comment above `KINDS` (lines 22–27) to record the quantisation:
   the reveal is stepped one cell per column of the grid, which is what
   `step(72, end)` was trying to say before it was dropped as invalid CSS.
3. Leave `fade`, `DURATION`, the ranges in the components, and the
   `reveal:play` / `reveal:reset` / `reveal:enter` handlers untouched.

## Out of scope

- Do not touch `src/components/Welcome.astro`, `Honors.astro`,
  `src/components/jobs/*` or any `data-reveal-range` value. The cascade of
  ranges is the scrolly-telling's design, not a defect.
- Do not change the `fade` easing, `DURATION`, `CAUGHT_UP`, the entrance delay,
  or the disclosure's spring.
- Do not swap `width` for `clip-path` / `transform` to make the reveal
  GPU-only. The typewriter depends on `word-break: break-all` reflowing text into
  the width it has; a clip would reveal a laid-out line instead of typing it.
- Do not add a dependency.

## Verification

**Build**

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` pass.

**Behavior**

- [ ] `pnpm dev`, then scroll slowly through `#welcome`: each line advances in
      visible increments rather than easing to near-full early.
- [ ] Measure it: with the page at a scroll position where a line is half way
      through its range, its `getBoundingClientRect().width` is ~50% of full,
      not ~80%. (Compare against a `data-reveal-range="50% 20%"` line in
      `Welcome.astro`.)
- [ ] Show more on the jobs list: the revealed rows still type in, staggered
      ~80ms apart, and land at full width.
- [ ] Hover a job open and closed: the heading still plays out on open and
      returns on close, now stepped like everything else.
- [ ] With `prefers-reduced-motion: reduce` emulated: lines are at full width
      with no stepping, the disclosure still fades, the cursor does not blink.

**Feel**

- [ ] Record the welcome section scrolling at ~200px/s and scrub the frames. The
      line should read as _typing_ — a new cell roughly every frame or two at
      that speed. If it reads as a series of jumps with pauses, the range (not
      the easing) is too short; report rather than editing ranges.
- [ ] Watch the entrance (click `show more`): 72 steps in ~1s should read as
      fast typing, not as stutter. If it stutters, report — the fix would be a
      shorter entrance duration, and that is a human decision.
- [ ] Watch the close of an open job: the heading returns stepped. If the
      stepped _return_ reads wrong (a reversing typewriter can look like the text
      being erased one cell at a time), say so in the hand-off rather than
      inventing a smooth easing for it.

## Notes

The audit could not judge two things from code alone, both for a human:

1. Whether 72 steps is the right quantisation for a line that is 40 characters
   long (72 sub-character steps read as typing, but are finer than one glyph per
   step). True per-character typing would need the line's character count, and
   that is a different feature.
2. Whether the stepped _return_ on close is charming or distracting. It follows
   automatically from this change; it is currently a smooth eased travel back.
