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
  /** a row entering on a click holds still until the scroll catches up */
  holding: boolean
}

/** Bind one element's animations to its scroll range. */
function bind(element: HTMLElement, holding = false): Reveal {
  const kind = (element.dataset.reveal || 'width') as Kind
  const steps = KINDS[kind] ?? KINDS.width
  const offset = toOffset(element.dataset.revealRange ?? '0% 20%')

  const animations = steps.map(({ keyframes, easing }) => {
    const animation = element.animate(keyframes, { duration: DURATION, easing, fill: 'both' })
    animation.pause()
    animation.currentTime = 0
    return animation
  })

  /** Park the animations at a frame. A seek on a running animation only moves
   * the playhead: it would carry on from there, which reads as a replay. */
  const seek = (time: number) => {
    for (const animation of animations) {
      if (animation.playState !== 'paused') animation.pause()
      animation.currentTime = time
    }
  }

  const reveal: Reveal = {
    animations,
    holding,
    unsync: () => {},
  }

  reveal.unsync = scroll(
    (progress) => {
      // A row that entered on a click stays where it landed until the scroll has
      // caught up. From there it is scrubbed like its neighbours, so scrolling
      // back up runs its reveal in reverse again.
      if (reveal.holding) {
        if (progress < CAUGHT_UP) return
        reveal.holding = false
      }
      seek(Math.min(1, Math.max(0, progress)) * DURATION)
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
 * the stagger as the detail; every `[data-reveal]` it holds is rewound at once
 * and played when its turn comes, so the row does not sit half-drawn while it
 * waits.
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
    // It was measured while folded away, so its range has to be taken again now
    // that it has a size. The old animations would keep a second opinion on the
    // same properties, so drop them.
    const previous = reveals.get(element)
    previous?.unsync()
    for (const animation of previous?.animations ?? []) animation.cancel()

    const reveal = bind(element, true)
    reveals.set(element, reveal)

    setTimeout(() => {
      for (const animation of reveal.animations) animation.play()
    }, delay)
  }
})
