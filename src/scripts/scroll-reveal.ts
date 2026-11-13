import { scroll } from 'motion'

/**
 * The reveal: a line grows from no width to its full measure, and
 * `word-break: break-all` reflows the text into the space it has as it grows.
 *
 * Only the scroll position comes from Motion. Width stays a browser animation,
 * paused and scrubbed by `currentTime`, so the interpolation happens in the
 * engine and no easing has to be reimplemented here. The easing is `ease`,
 * which is what the CSS these replace actually rendered: `step(72, end)` is not
 * a CSS function, so that declaration was dropped and the initial `ease` stood.
 */
const REVEAL: Keyframe[] = [{ width: '0' }, { width: '100%' }]
const DURATION = 1000

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
  const offset = toOffset(element.dataset.revealRange ?? '0% 20%')

  const animation = element.animate(REVEAL, { duration: DURATION, easing: 'ease', fill: 'both' })
  animation.pause()
  animation.currentTime = 0

  scroll(
    (progress) => {
      animation.currentTime = Math.min(1, Math.max(0, progress)) * DURATION
    },
    { target: element, offset },
  )
}
