/**
 * An illustration losing sync while the page moves: as you scroll, now and then a
 * band of one art block, a row or three tall, jumps sideways by a character cell
 * or three and snaps back. Never the whole block, never on a steady beat, and
 * never while the page is still — the interference belongs to the movement.
 *
 * The exception is a block marked `data-glitch="loop"`, the header's: it glitches
 * on its own, page moving or not, in runs of a few glitches with a quiet gap
 * between them, and the scroll leaves it alone.
 *
 * The band is a ghost copy of the art, cloned here once per block, clipped to
 * those rows and moved. Rows cannot be moved on their own: giving a row its own
 * box stops the block glyphs abutting and opens hairline seams in the solid
 * areas. The copy is made at runtime rather than shipped, which would double the
 * art's bytes.
 *
 * Alongside that, single cells flicker: inverted or knocked out, at a cell the
 * block draws. Several can be on screen at once, on the same block or different
 * ones. Nothing is touched off screen, in a hidden tab, or under
 * `prefers-reduced-motion`.
 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

/** ms between glitches while the page is moving, or in a loop's run — wide and uneven */
const NEXT = [60, 190] as const
/** how many glitches make one run of a loop */
const RUN = [2, 5] as const
/** ms of quiet between a loop's runs */
const QUIET = [800, 2500] as const
/** ms without a scroll event before the page counts as stopped */
const STILL = 220
/** share of glitches that are a band tear rather than a cell flicker */
const TEAR = 0.18
/** how long one burst holds its displacement, in ms */
const HOLD = [55, 120] as const
/** how likely a burst is to be followed immediately by another */
const REPEAT = 0.4
/** how long one cell stays, in ms */
const BLINK = [160, 340] as const

const between = ([min, max]: readonly [number, number]) => min + Math.random() * (max - min)
const whole = (n: number) => Math.floor(Math.random() * n)

/**
 * The cells a block actually draws, and the characters it draws them with, taken
 * once at startup — before the ghost copy exists, which would double both.
 */
const alphabets = new Map<
  HTMLPreElement,
  { glyphs: string[]; lit: { row: number; col: number }[] }
>()
const alphabetOf = (pre: HTMLPreElement) => {
  const known = alphabets.get(pre)
  if (known) return known

  const lit: { row: number; col: number }[] = []
  const glyphs = new Set<string>()
  ;(pre.textContent ?? '').split('\n').forEach((line, row) => {
    ;[...line].forEach((glyph, col) => {
      if (glyph === ' ') return
      lit.push({ row, col })
      glyphs.add(glyph)
    })
  })

  const alphabet = { glyphs: [...glyphs], lit }
  alphabets.set(pre, alphabet)
  return alphabet
}

/**
 * A cell and a row of a block, in px, read off its `<pre>`: the art's size and
 * line height are set there, not on the block around it. A cell is 0.6em in this
 * face (README: every glyph advances 0.6000em), so a move in whole cells stays on
 * the character grid.
 */
const metrics = (pre: HTMLElement) => {
  const style = getComputedStyle(pre)
  const size = Number.parseFloat(style.fontSize)
  return { cell: size * 0.6, row: Number.parseFloat(style.lineHeight) || size }
}

/**
 * One cell blinking over a character the block has drawn, then gone. The cell is
 * inverted — phosphor block, black glyph, the terminal's own selection — because a
 * brighter glyph over a cell that is already phosphor, ten pixels wide, is not a
 * glitch anyone sees. Every other one is a hole instead: the cell knocked out.
 */
const flicker = (block: HTMLElement) => {
  const pre = block.querySelector<HTMLPreElement>('pre')
  if (!pre) return

  const { glyphs, lit } = alphabetOf(pre)
  const patch = lit[whole(lit.length)]
  if (!patch || !glyphs.length) return

  const { cell, row } = metrics(pre)
  const hole = whole(2) === 0
  const box = [`width:${cell.toFixed(2)}px`, `height:${row.toFixed(2)}px`]

  const blot = document.createElement('span')
  blot.dataset.artFlicker = ''
  blot.setAttribute('aria-hidden', 'true')
  blot.style.cssText = [
    'position:absolute',
    `left:${(patch.col * cell).toFixed(2)}px`,
    `top:${(patch.row * row).toFixed(2)}px`,
    'pointer-events:none',
    hole
      ? ['background:var(--color-black)', ...box]
      : ['background:var(--color-green-900)', 'color:var(--color-black)', ...box],
  ].join(';')
  if (!hole) blot.textContent = glyphs[whole(glyphs.length)] ?? ' '
  pre.append(blot)

  // Blinking, not fading: a stale cell being rewritten.
  blot
    .animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }], {
      duration: between(BLINK),
      easing: 'steps(1, end)',
    })
    .finished.then(
      () => blot.remove(),
      () => blot.remove(),
    )
}

const onScreen = (element: HTMLElement) => {
  const box = element.getBoundingClientRect()
  return box.height > 0 && box.bottom > 0 && box.top < innerHeight
}

/** A whole second copy of the block's markup, parked over it and clipped away. */
const ghostOf = (block: HTMLElement) => {
  const pre = block.querySelector('pre')
  if (!pre) return undefined

  const existing = pre.querySelector<HTMLElement>('[data-art-ghost]')
  if (existing) return existing

  const ghost = document.createElement('span')
  ghost.className = 'art-ghost'
  ghost.dataset.artGhost = ''
  ghost.setAttribute('aria-hidden', 'true')
  ghost.innerHTML = pre.innerHTML
  pre.append(ghost)
  return ghost
}

/** The blocks the scroll glitches: on screen, and not looping on their own. */
const shown = () => [...document.querySelectorAll<HTMLElement>('[data-glitch=""]')].filter(onScreen)

const burst = (block: HTMLElement) => {
  const ghost = ghostOf(block)
  const pre = ghost?.parentElement
  if (!ghost || !pre) return

  const { cell, row } = metrics(pre)
  const height = pre.offsetHeight

  const rows = 1 + whole(3)
  const top = whole(Math.max(1, Math.round((height - rows * row) / row))) * row
  const cells = (1 + whole(3)) * (whole(2) ? -1 : 1)
  const bottom = Math.max(0, height - top - rows * row)

  ghost.style.clipPath = `inset(${top}px 0 ${bottom}px 0)`
  ghost.style.transform = `translateX(${cells * cell}px)`
  ghost.style.visibility = 'visible'

  setTimeout(() => {
    ghost.style.visibility = 'hidden'
  }, between(HOLD))
}

/** Tab in front and motion allowed. Visibility is checked per block, in `shown`. */
const awake = () => !document.hidden && !reduced.matches

/** One glitch on one block: a band tear, now and then, or a cell flicker. */
const glitch = (block: HTMLElement) => {
  if (Math.random() < TEAR) {
    burst(block)
    if (Math.random() < REPEAT) setTimeout(() => awake() && burst(block), between(HOLD))
  } else {
    flicker(block)
    // A second cell, so the flicker has company rather than arriving alone.
    if (Math.random() < 0.5) setTimeout(() => awake() && flicker(block), between([0, 120]))
  }
}

/**
 * One glitch, at a time, while the page moves. A chain rather than a timer: the
 * next one is booked only after this one, and only while scroll events keep
 * arriving, so the interference starts when the page does and stops when it does.
 */
const beat = () => {
  pending = undefined

  if (!awake() || performance.now() - lastScroll > STILL) return

  const visible = shown()
  const block = visible[whole(visible.length)]
  if (block) glitch(block)

  schedule()
}

/** The blocks that glitch on their own. */
const looping = document.querySelectorAll<HTMLElement>('[data-glitch="loop"]')
/** Each looping block's next step, for as long as its chain runs. */
const loops = new Map<HTMLElement, ReturnType<typeof setTimeout>>()
/** The looping blocks the observer last saw on screen. */
const seen = new Set<Element>()

/**
 * A looping block's chain: `left` glitches to go in this run, at the scroll's
 * pace, then a quiet gap and a new run.
 */
const loop = (block: HTMLElement, left = 0) => {
  if (left === 0) {
    const run = RUN[0] + whole(RUN[1] - RUN[0] + 1)
    loops.set(block, setTimeout(loop, between(QUIET), block, run))
    return
  }
  glitch(block)
  loops.set(block, setTimeout(loop, between(NEXT), block, left - 1))
}

/**
 * Runs each looping block's chain only while someone could see it: on screen,
 * the tab in front, motion allowed. Otherwise it stops, and coming back starts
 * it afresh, with a quiet gap first, as the page load does.
 */
const tend = () => {
  for (const block of looping) {
    const wanted = awake() && seen.has(block)
    if (wanted && !loops.has(block)) loop(block)
    if (!wanted && loops.has(block)) {
      clearTimeout(loops.get(block))
      loops.delete(block)
    }
  }
}

const schedule = () => {
  if (!pending) pending = setTimeout(beat, between(NEXT))
}

let pending: ReturnType<typeof setTimeout> | undefined
let lastScroll = 0

addEventListener(
  'scroll',
  () => {
    const now = performance.now()
    // The first event of a scroll is the one the eye is attending to, so it
    // glitches straight away rather than waiting out the gap. A wheel notch is
    // short; leaving it to the chain meant whole bursts went by unseen.
    const starting = now - lastScroll > STILL
    lastScroll = now
    if (!awake()) return

    if (starting) {
      clearTimeout(pending)
      pending = undefined
      setTimeout(beat, between([20, 70]))
    } else {
      schedule()
    }
  },
  { passive: true },
)

// Read every block's cells now, before any ghost copy can be cloned into it.
for (const pre of document.querySelectorAll<HTMLPreElement>('[data-glitch] pre')) alphabetOf(pre)

const sight = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    if (isIntersecting) seen.add(target)
    else seen.delete(target)
  }
  tend()
})
for (const block of looping) sight.observe(block)
document.addEventListener('visibilitychange', tend)
reduced.addEventListener('change', tend)

// A module, so its helpers do not land in the page's global scope.
export {}
