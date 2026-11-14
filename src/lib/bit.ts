/**
 * The stray bit's settings and its flight plan, shared by the page script
 * (`scripts/bit.ts`), the dev-only lab that tunes it (`components/bit-lab/`) and
 * the lab's save endpoint (`dev/bit-lab.ts`). Nothing here touches the DOM, so
 * the endpoint can run it under Node.
 *
 * A flight is a pure function of the settings, a seed and the screen it crosses:
 * the same three always plan the same path, which is what lets the lab replay
 * one and save it.
 */

/** The phosphor steps in main.css, by name. */
export const GREENS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const
export type Green = (typeof GREENS)[number]

type Range = readonly [number, number]

export interface BitConfig {
  /** the flight the lab replays and saves; on the page every trip draws its own */
  seed: number
  /** px: a bit is a lit square, not a glyph on the grid */
  size: number
  lead: Green
  trail: Green
  /** how many copies replay the flight behind the bit */
  followers: number
  /** ms each follower runs behind the one ahead of it */
  lag: number
  /** the trail's opacity is `(1 - i / n) ** fade`: 1 is linear, more dies off sooner */
  fade: number
  /** px per second, drawn afresh for each leg so the flight lurches */
  speed: Range
  /** ms between trips */
  gap: Range
  /** right-angle turns per trip */
  turns: Range
  /** how far one leg along the crossing goes, as a share of the screen */
  stride: Range
  /** the least a sideways leg moves, as a share of the screen */
  swerve: number
}

type Scalar = Exclude<keyof BitConfig, 'lead' | 'trail'>

/**
 * What each number may be, and the step it moves in. Every value in range plans
 * a flight that enters, turns and leaves; the lab's sliders stop at these, and
 * the endpoint refuses anything outside them.
 */
export const BOUNDS: Record<Scalar, { min: number; max: number; step: number }> = {
  seed: { min: 0, max: 2 ** 32 - 1, step: 1 },
  size: { min: 2, max: 24, step: 1 },
  followers: { min: 0, max: 256, step: 1 },
  lag: { min: 1, max: 40, step: 1 },
  fade: { min: 0.25, max: 4, step: 0.05 },
  speed: { min: 50, max: 3000, step: 10 },
  gap: { min: 200, max: 60000, step: 100 },
  turns: { min: 0, max: 8, step: 1 },
  stride: { min: 0.02, max: 0.6, step: 0.01 },
  // Past a half, a bit in the middle of the screen would have nowhere to go.
  swerve: { min: 0, max: 0.5, step: 0.01 },
}

const RANGES = ['speed', 'gap', 'turns', 'stride'] as const
/** counts and whole pixels; a slider cannot reach a fraction of these */
const WHOLE = ['seed', 'size', 'followers', 'lag', 'turns'] as const

/** Checks a settings object field by field and says which one is wrong. */
export function parseBitConfig(value: unknown): BitConfig {
  if (typeof value !== 'object' || value === null)
    throw new Error('bit: settings are not an object')
  const input = value as Record<string, unknown>

  const inBounds = (key: Scalar, n: unknown): n is number =>
    typeof n === 'number' &&
    Number.isFinite(n) &&
    n >= BOUNDS[key].min &&
    n <= BOUNDS[key].max &&
    (!(WHOLE as readonly string[]).includes(key) || Number.isInteger(n))

  for (const key of Object.keys(BOUNDS) as Scalar[]) {
    const n = input[key]
    if ((RANGES as readonly string[]).includes(key)) {
      if (!Array.isArray(n) || n.length !== 2 || !n.every((end) => inBounds(key, end)))
        throw new Error(
          `bit: ${key} must be [min, max] within ${BOUNDS[key].min}–${BOUNDS[key].max}`,
        )
      if ((n[0] as number) > (n[1] as number)) throw new Error(`bit: ${key} runs backwards`)
    } else if (!inBounds(key, n)) {
      throw new Error(`bit: ${key} must be within ${BOUNDS[key].min}–${BOUNDS[key].max}`)
    }
  }
  for (const key of ['lead', 'trail'] as const) {
    if (!(GREENS as readonly unknown[]).includes(input[key]))
      throw new Error(`bit: ${key} must be one of ${GREENS.join(', ')}`)
  }

  return input as unknown as BitConfig
}

/** A small seeded generator, so a seed is a flight. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 32)

type Axis = 'x' | 'y'

/** The part of the page on screen as the trip starts, in page coordinates. */
export interface Screen {
  box: Record<Axis, Range>
  /** the bit's own box, so it can start and finish just past an edge */
  size: Record<Axis, number>
}

export interface Flight {
  keyframes: Keyframe[]
  duration: number
}

/**
 * Plans one trip: in off one edge, along one axis and across the other in
 * turn, and out off an edge. Every leg is straight and every turn is a right
 * angle.
 */
export function plan(config: BitConfig, seed: number, { box, size }: Screen): Flight {
  const random = mulberry32(seed)
  const between = ([min, max]: Range) => min + random() * (max - min)
  const coin = () => random() < 0.5

  // Just past an edge, so it enters and leaves whole.
  const outside = (axis: Axis, forward: boolean) =>
    forward ? box[axis][1] + size[axis] : box[axis][0] - size[axis]

  // The edge it enters by sets the crossing: the axis it travels along and
  // which way. The other axis is where it wanders.
  const along: Axis = coin() ? 'x' : 'y'
  const across: Axis = along === 'x' ? 'y' : 'x'
  const forward = coin()
  const pos: Record<Axis, number> = { x: 0, y: 0 }
  pos[along] = outside(along, !forward)
  pos[across] = between(box[across])

  const turns = config.turns[0] + Math.floor(random() * (config.turns[1] - config.turns[0] + 1))
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
      const step = between(config.stride) * (max - min)
      pos[axis] = Math.max(min, Math.min(max, from + (forward ? step : -step)))
    } else {
      // A real turn: towards the side with more room, by at least `swerve`.
      const up = from - min
      const down = max - from
      const room = Math.max(up, down)
      const step = between([Math.min(config.swerve * (max - min), room), room])
      pos[axis] = up > down ? from - step : from + step
    }

    time += (Math.abs(pos[axis] - from) / between(config.speed)) * 1000
    points.push({ ...pos, time })
  }

  return {
    keyframes: points.map((point) => ({
      transform: `translate3d(${point.x}px, ${point.y}px, 0)`,
      offset: time ? point.time / time : 0,
    })),
    duration: time,
  }
}
