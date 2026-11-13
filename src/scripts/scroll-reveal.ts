import { scroll } from 'motion'

/**
 * Every reveal on the page: Motion reports how far an element has travelled, and
 * the animation itself is a browser animation, paused and scrubbed here through
 * `currentTime`. Interpolation stays in the engine, so no easing is reimplemented
 * and the browser keeps whatever it is fastest at.
 *
 * These replace CSS scroll-driven animations. The easings are the ones those
 * actually rendered: `step(72, end)` and `step(72)` are not CSS functions, so
 * those declarations were dropped and the initial `ease` stood, while the
 * `linear` fades were explicit.
 */
const DURATION = 1000

type Kind = 'width' | 'fade'

/**
 * `width` grows a line from nothing to its full measure, which is the reveal the
 * introduction types out; it needs `break-all` and a fixed line height on the
 * element, since the text reflows into the width it has. `fade` brings a block
 * up from nothing, for the art and the honors rows.
 */
const KINDS: Record<Kind, { keyframes: Keyframe[]; easing: string }[]> = {
  width: [{ keyframes: [{ width: '0' }, { width: '100%' }], easing: 'ease' }],
  fade: [{ keyframes: [{ opacity: 0 }, { opacity: 1 }], easing: 'linear' }],
}

/** Motion does not export its `ScrollOffset` type, so borrow it off the function. */
type ScrollOffset = NonNullable<Parameters<typeof scroll>[1]>['offset']

/**
 * A CSS view() range and a Motion offset are the same two edges, crossed the
 * other way round. `view(50% 20%)` starts when the subject's start edge is at
 * the scrollport's end inset (100% - 20% = 80% down) and finishes when its end
 * edge reaches the start inset (50% down).
 */
function toOffset(range: string): ScrollOffset {
  const [start = '0%', end = '20%'] = range.trim().split(/\s+/)
  const edges = [`start ${100 - Number.parseFloat(end)}%`, `end ${start}`]
  // Composed edges are strings; Motion's type is a union of literal templates.
  return edges as unknown as ScrollOffset
}

for (const element of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
  const kind = (element.dataset.reveal || 'width') as Kind
  const steps = KINDS[kind] ?? KINDS.width
  const offset = toOffset(element.dataset.revealRange ?? '0% 20%')

  const animations = steps.map(({ keyframes, easing }) => {
    const animation = element.animate(keyframes, { duration: DURATION, easing, fill: 'both' })
    animation.pause()
    animation.currentTime = 0
    return animation
  })

  scroll(
    (progress) => {
      const time = Math.min(1, Math.max(0, progress)) * DURATION
      for (const animation of animations) animation.currentTime = time
    },
    { target: element, offset },
  )
}
