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

const reduced = matchMedia('(prefers-reduced-motion: reduce)')

type Kind = 'width' | 'fade'

/**
 * `width` grows a line from nothing to its full measure, which is the reveal the
 * introduction types out; it needs `break-all` and a fixed line height on the
 * element, since the text reflows into the width it has. It is drawn in `steps(72,
 * end)`, one step per column of the grid, so the line types as the scroll moves
 * instead of easing to nearly full early: half a range is half a line. That is
 * what the CSS meant by `step(72, end)`, which is not a CSS function and was
 * dropped, leaving `ease`. `fade` brings a block up from nothing, for the art and
 * the honors rows, and stays linear because the scroll scrubs it.
 */
const KINDS: Record<Kind, { keyframes: Keyframe[]; easing: string; props: string[] }[]> = {
  width: [
    { keyframes: [{ width: '0' }, { width: '100%' }], easing: 'steps(72, end)', props: ['width'] },
  ],
  fade: [{ keyframes: [{ opacity: 0 }, { opacity: 1 }], easing: 'linear', props: ['opacity'] }],
}

const steps = (element: HTMLElement) =>
  KINDS[(element.dataset.reveal || 'width') as Kind] ?? KINDS.width

/** The reveals a row owns, itself included. */
const revealsIn = (row: Element) => [
  ...(row.matches('[data-reveal]') ? [row as HTMLElement] : []),
  ...row.querySelectorAll<HTMLElement>('[data-reveal]'),
]

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
  /** the row is open, so the line is shown in full whatever the scroll says */
  open: boolean
  /** it entered on a click and waits at full for the scroll to catch up */
  held: boolean
  /** reduced motion: the line is simply there, never typed */
  still: boolean
  /** the last progress the scroll reported, kept up to date while it is ignored */
  progress: number
  /** the animation carrying the line back to its scroll position, while it runs */
  settling?: Animation
  /** park the animations at a frame */
  seek: (time: number) => void
  /** let the scroll take the element back, if it may */
  resume: () => void
  /** carry the line back to a frame of the timeline */
  settle: (time: number) => void
}

/** Bind one element's animations to its scroll range. */
function bind(element: HTMLElement, entering = false): Reveal {
  const offset = toOffset(element.dataset.revealRange ?? '0% 20%')
  // A reveal is movement, and reduced motion keeps the state rather than the
  // travel: the line starts and stays at full.
  const still = reduced.matches
  const start = still || entering ? DURATION : 0

  const animations = steps(element).map(({ keyframes, easing }) => {
    const animation = element.animate(keyframes, { duration: DURATION, easing, fill: 'both' })
    animation.pause()
    animation.currentTime = start
    return animation
  })

  // Park the animations at a frame. A seek on a running animation only moves the
  // playhead: it would carry on from there, which reads as a replay.
  const seek = (time: number) => {
    for (const animation of animations) {
      if (animation.playState !== 'paused') animation.pause()
      animation.currentTime = time
    }
  }

  const reveal: Reveal = {
    animations,
    entering,
    open: false,
    held: false,
    still,
    progress: 0,
    seek,
    settle: () => {},
    resume: () => {},
    unsync: () => {},
  }

  /** Off the scroll's leash: entering, open, or already on its way back. */
  const free = () => {
    if (reveal.entering || reveal.open || reveal.settling) return false
    if (reveal.held) {
      if (reveal.progress < CAUGHT_UP) return false
      reveal.held = false
    }
    return true
  }

  const apply = () => {
    if (reveal.still) {
      seek(DURATION)
      return
    }

    // While a row is entering, the scroll must not touch it: a seek would cut the
    // entrance short. An open row shows its whole line instead of the scroll's.
    if (!free()) return

    seek(reveal.progress * DURATION)
  }

  /** Carry the line back to `time`, rather than jumping it there. */
  reveal.settle = (time: number) => {
    const specs = steps(element)
    const from = Number(animations[0]?.currentTime ?? 0)
    const distance = Math.abs(from - time)
    if (distance < 1) {
      seek(time)
      return
    }

    // The value at a frame is the browser's answer, not ours: ask it twice, with
    // the animations parked at each end, then animate between the two answers.
    const props = specs.flatMap((spec) => spec.props)
    const read = () => {
      const style = getComputedStyle(element)
      return props.map((prop) => style.getPropertyValue(prop))
    }
    const was = read()
    seek(time)
    const becomes = read()
    seek(from)

    reveal.settling = element.animate(
      [
        Object.fromEntries(props.map((prop, index) => [prop, was[index]])),
        Object.fromEntries(props.map((prop, index) => [prop, becomes[index]])),
      ],
      { duration: distance, easing: specs[0]?.easing ?? 'ease', fill: 'both' },
    )

    reveal.settling.finished
      .then(() => {
        reveal.settling?.cancel()
        reveal.settling = undefined
        seek(time)
      })
      .catch(() => {
        // an open cancelled it
      })
  }

  reveal.resume = apply
  if (still) return reveal

  reveal.unsync = scroll(
    (progress) => {
      reveal.progress = Math.min(1, Math.max(0, progress))
      apply()
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

  for (const element of revealsIn(row)) {
    const previous = reveals.get(element)
    previous?.unsync()
    for (const animation of previous?.animations ?? []) animation.cancel()

    const reveal = bind(element, true)
    reveals.set(element, reveal)

    // Nothing to type when motion is reduced: the line is already at full.
    if (reveal.still) continue

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

/**
 * A row that is opening shows its line whole, so the reveal is played out rather
 * than left at whatever the scroll last said. `disclosure.ts` asks for this as
 * the panel starts to open.
 */
document.addEventListener('reveal:play', (event) => {
  const row = event.target
  if (!(row instanceof Element)) return

  for (const element of revealsIn(row)) {
    const reveal = reveals.get(element)
    if (!reveal) continue

    reveal.open = true
    reveal.settling?.cancel()
    reveal.settling = undefined

    if (reduced.matches) {
      reveal.seek(DURATION)
      continue
    }

    for (const animation of reveal.animations) {
      // Already at the end is already revealed; replaying would blink.
      if (animation.playState === 'paused' && Number(animation.currentTime) < DURATION) {
        animation.play()
      }
    }
  }
})

/**
 * The row has closed, so the line goes back to the scroll — animated back to
 * wherever the scroll has got to while the row was open, not snapped there.
 * `disclosure.ts` asks for this once the close has finished.
 */
document.addEventListener('reveal:reset', (event) => {
  const row = event.target
  if (!(row instanceof Element)) return

  for (const element of revealsIn(row)) {
    const reveal = reveals.get(element)
    if (!reveal) continue

    reveal.open = false
    // Reduced motion puts the line back at once rather than drawing the return.
    if (reduced.matches || reveal.entering || reveal.held) {
      reveal.resume()
      continue
    }
    reveal.settle(reveal.progress * DURATION)
  }
})
