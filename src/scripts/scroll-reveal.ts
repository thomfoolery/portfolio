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

/** Where the scroll is close enough to done that a row can be handed back to it. */
const CAUGHT_UP = 0.99

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

const steps = (element: HTMLElement) =>
  KINDS[(element.dataset.reveal || 'width') as Kind] ?? KINDS.width

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

interface Reveal {
  animations: Animation[]
  /** stops the scroll binding; a rebind starts from scratch */
  unsync: () => void
  /** an entrance owns the element, so the scroll leaves it alone */
  entering: boolean
  /** it entered on a click and waits at full for the scroll to catch up */
  held: boolean
}

/** Bind one element's animations to its scroll range. */
function bind(element: HTMLElement, entering = false): Reveal {
  const offset = toOffset(element.dataset.revealRange ?? '0% 20%')
  const start = entering ? DURATION : 0

  const animations = steps(element).map(({ keyframes, easing }) => {
    const animation = element.animate(keyframes, { duration: DURATION, easing, fill: 'both' })
    animation.pause()
    animation.currentTime = start
    return animation
  })

  const reveal: Reveal = { animations, entering, held: false, unsync: () => {} }

  reveal.unsync = scroll(
    (progress) => {
      // While a row is entering, the scroll must not touch it: a seek would cut
      // the entrance short. It is handed back once the entrance has finished.
      if (reveal.entering) return

      if (reveal.held) {
        if (progress < CAUGHT_UP) return
        reveal.held = false
      }

      // Park the animations at a frame. A seek on a running animation only moves
      // the playhead: it would carry on from there, which reads as a replay.
      const time = Math.min(1, Math.max(0, progress)) * DURATION
      for (const animation of animations) {
        if (animation.playState !== 'paused') animation.pause()
        animation.currentTime = time
      }
    },
    { target: element, offset },
  )

  return reveal
}

const reveals = new Map<HTMLElement, Reveal>()
for (const element of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
  reveals.set(element, bind(element))
}

/**
 * `show-more.js` asks a revealed row to enter instead of waiting for a scroll
 * that has already gone past it. The row fires `reveal:enter` with its place in
 * the stagger as the detail.
 *
 * The entrance is its own animation, played on top of a scroll animation parked
 * at full, and it cancels itself when it lands: from then on the scroll owns the
 * element. It was measured while folded away, so the scroll range is taken again
 * now that it has a size.
 */
document.addEventListener('reveal:enter', (event) => {
  const row = event.target
  if (!(row instanceof Element)) return

  const delay = Number((event as CustomEvent<number>).detail) || 0
  const elements = [
    ...(row.matches('[data-reveal]') ? [row as HTMLElement] : []),
    ...row.querySelectorAll<HTMLElement>('[data-reveal]'),
  ]

  for (const element of elements) {
    const previous = reveals.get(element)
    previous?.unsync()
    for (const animation of previous?.animations ?? []) animation.cancel()

    const reveal = bind(element, true)
    reveals.set(element, reveal)

    // Created now and held at their first frame, so a row waiting its turn shows
    // nothing rather than the full line the scroll animation is parked on.
    const entrances = steps(element).map(({ keyframes, easing }) =>
      element.animate(keyframes, { duration: DURATION, easing, fill: 'both' }),
    )
    for (const entrance of entrances) entrance.pause()

    setTimeout(() => {
      for (const entrance of entrances) entrance.play()
    }, delay)

    Promise.all(entrances.map((entrance) => entrance.finished))
      .then(() => {
        for (const entrance of entrances) entrance.cancel()
        reveal.entering = false
        // Stay where the entrance landed until the scroll has caught up, so the
        // row does not drop to whatever the viewport says it should be.
        reveal.held = true
      })
      .catch(() => {
        // cancelled by the next click
      })
  }
})
