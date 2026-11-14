/**
 * Flies the stray bit in Bit.astro. Each trip enters off one edge of what is on
 * screen and moves only up, down, left or right, turning at a right angle two to
 * five times before it leaves off an edge. Positions are page coordinates, so
 * the bit stays where it is on the page when you scroll.
 *
 * The first span leads; the rest play the same keyframes `LAG` ms later each,
 * fading, which draws the trail along the exact path, turns included.
 */
const layer = document.querySelector<HTMLElement>('[data-bit-layer]')
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

/** ms each follower runs behind the one ahead of it */
const LAG = 6
/** px per second, chosen afresh for each leg so the flight lurches */
const SPEED = [250, 900] as const
/** ms between trips */
const GAP = [8000, 25000] as const
/** how far one leg along the crossing goes, as a share of the screen */
const STRIDE = [0.1, 0.28] as const

const between = ([min, max]: readonly [number, number]) => min + Math.random() * (max - min)
const coin = () => Math.random() < 0.5

const spans = [...(layer?.querySelectorAll<HTMLElement>('[data-bit]') ?? [])]
const [lead] = spans

type Axis = 'x' | 'y'

if (layer && lead) {
  spans.forEach((span, i) => {
    span.style.opacity = String(1 - i / spans.length)
  })

  const fly = () => {
    const height = document.documentElement.scrollHeight
    const size = lead.offsetWidth
    // It crosses what is on screen as the trip starts. That box is fixed on the
    // page from then on, so a scroll carries the bit off with the text.
    const box = {
      x: [0, document.documentElement.clientWidth - size],
      y: [scrollY, Math.min(height, scrollY + innerHeight) - size],
    } as const
    const inside = (axis: Axis) => between(box[axis])
    // Just past an edge, so it enters and leaves whole.
    const outside = (axis: Axis, forward: boolean) =>
      forward ? box[axis][1] + size : box[axis][0] - size

    // The edge it enters by sets the crossing: the axis it travels along and
    // which way. The other axis is where it wanders.
    const along: Axis = coin() ? 'x' : 'y'
    const across: Axis = along === 'x' ? 'y' : 'x'
    const forward = coin()
    const pos: Record<Axis, number> = { x: 0, y: 0 }
    pos[along] = outside(along, !forward)
    pos[across] = inside(across)

    const turns = 2 + Math.floor(Math.random() * 4)
    let time = 0
    const points = [{ ...pos, time }]

    for (let leg = 0; leg <= turns; leg++) {
      const axis = leg % 2 ? across : along
      const [min, max] = box[axis]
      const from = pos[axis]
      if (leg === turns) {
        // The last leg runs out: on along, to the far side; on across, off
        // whichever edge it is heading for.
        pos[axis] = axis === along ? outside(axis, forward) : outside(axis, coin())
      } else if (axis === along) {
        const step = between(STRIDE) * (max - min)
        pos[axis] = Math.max(min, Math.min(max, from + (forward ? step : -step)))
      } else {
        // A real turn: at least a sixth of the screen off where it was.
        let next: number
        do next = inside(axis)
        while (Math.abs(next - from) < (max - min) / 6)
        pos[axis] = next
      }

      time += (Math.abs(pos[axis] - from) / between(SPEED)) * 1000
      points.push({ ...pos, time })
    }

    const keyframes = points.map((point) => ({
      transform: `translate3d(${point.x}px, ${point.y}px, 0)`,
      offset: point.time / time,
    }))

    layer.style.height = `${height}px`
    layer.dataset.flying = ''

    const flights = spans.map((s, i) =>
      s.animate(keyframes, { duration: time, delay: i * LAG, easing: 'linear', fill: 'both' }),
    )

    void Promise.all(flights.map((flight) => flight.finished)).then(() => {
      delete layer.dataset.flying
      layer.style.height = ''
      for (const flight of flights) flight.cancel()
      schedule()
    })
  }

  const schedule = () => {
    setTimeout(() => {
      // Nobody is watching a hidden tab, and a reduced-motion reader asked not to.
      if (document.hidden || reduced.matches) schedule()
      else fly()
    }, between(GAP))
  }

  schedule()
}
