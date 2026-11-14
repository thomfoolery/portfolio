# Animation plans

Produced by the `improve-animations` audit against commit `843faac`. One plan per
finding; each is self-contained and written for an executor with no context from
the audit.

| Plan | Title                                                                   | Severity | Depends on | Status |
| ---- | ----------------------------------------------------------------------- | -------- | ---------- | ------ |
| 001  | [Quantise the text reveal to character cells](001-typewriter-reveal.md) | MEDIUM   | —          | OPEN   |

**Recommended order:** 001 alone — executed, see its hand-off. It is a single spec line plus a comment, and the
entrance and the close-return inherit it automatically — so it must be felt
(frame-scrubbed) before anything else is layered on top.

## Considered and not filed

Recorded so a later pass does not re-open them as new findings.

- **The reveal animates `width`, a layout property.** Deliberate and documented in
  `README.md` and `scripts/scroll-reveal.ts`: the typewriter depends on
  `word-break: break-all` reflowing text into the shrinking box. A composite-only
  reveal (`clip-path` / `transform`) would show a finished line being uncovered
  instead of typed. Not a defect; a different effect.
- **The disclosure animates `height`.** Settled in the motion brief of
  `2026-…` review: pushing the rows below _is_ the purpose of that motion.
- **`linear` on the `fade` kind.** It is scroll-scrubbed, so constant progress is
  the correct mapping, not robotic timing. Audit’s `linear` rule is about
  time-driven UI motion.
- **`linear` on the stray bit (`scripts/bit.ts`).** Constant motion, exempt.
- **Hover-open on a row crossed often.** Settled in the brief: a 250 ms dwell
  separates intent from a pointer passing through, and `(hover: hover)` gates it.
- **The cursor caret has no smoothing/spring.** Correct — a pointer must track
  the hand 1:1.
- **`transition-opacity` hover reveal on the art (`ArtHtml.astro:38`,
  `Footer.astro:34`) at `duration-500` in, `200` out.** Measured against the
  audit’s hover budget (100–150 ms) this is slow, but it is the one deliberately
  lingering hover on the page and it reveals art rather than confirming an
  affordance. Filed as a judgement call, not a plan.
- **Stagger of 80 ms on `show-more` rows.** Inside the 30–80 ms band, and the
  rows are not a menu, so it is not the “staggered menu items” rule.
