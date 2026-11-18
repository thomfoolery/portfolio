import { parseBitConfig, plan, randomSeed, trace } from '@/lib/bit'
import type { BitConfig, Point } from '@/lib/bit'
import settings from '@/data/bit.json'

/**
 * Flies the stray bit in Bit.astro, every `gap` ms, on a path `lib/bit.ts`
 * plans from a fresh seed. Positions are page coordinates, so the bit stays
 * where it is on the page when you scroll.
 *
 * The trail is not drawn: the bit is, on a canvas the size of the screen as the
 * trip starts, and nothing is cleared. Every frame dims what is there by `fade`
 * and draws the bit where it is now, stretched back to where it was the frame
 * before, through any corner it turned, so the trail is one unbroken line at any
 * speed and fades out behind it. The stretch is the trail's colour and the bit
 * the lead's, drawn over it, so the next stretch covers it.
 *
 * Only a fine pointer gets it, as with the caret: on a phone it is a lot of
 * moving parts for a dot too small to notice.
 *
 * `bit` is exported for the dev-only lab, which retunes and relaunches it in
 * place. Each launch says so with a `bit:fly` event on the canvas.
 */
const canvas = document.querySelector<HTMLCanvasElement>('[data-bit]')
const context = matchMedia('(pointer: fine)').matches ? canvas?.getContext('2d') : undefined
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

/** A 60th of a second, the time `fade` is measured in. */
const TICK = 1000 / 60
/**
 * The trail dims at most this often, by however long it has been. A fade that
 * small rounds to nothing on a dim pixel, so dimming every frame of a 120 Hz
 * screen would leave a faint ghost of the whole path.
 */
const DIM_EVERY = 12

/** A step of the theme's green, as a colour the canvas can use. */
const green = (step: number) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--color-green-${step}`)

function start(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  let config = parseBitConfig(settings)
  let frame: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const land = () => {
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    canvas.hidden = true
  }

  const schedule = () => {
    clearTimeout(timer)
    // Nobody is watching a hidden tab, and a reduced-motion reader asked not to:
    // nothing waits for the next trip until that changes.
    if (document.hidden || reduced.matches) return
    const [min, max] = config.gap
    timer = setTimeout(() => fly(), min + Math.random() * (max - min))
  }

  /** Between trips, a tab coming back or motion allowed again starts the wait. */
  const resume = () => {
    if (frame === undefined) schedule()
  }

  const fly = (seed = randomSeed()) => {
    clearTimeout(timer)
    land()

    const { size, fade } = config
    const width = document.documentElement.clientWidth
    const top = Math.round(scrollY)
    const bottom = Math.min(document.documentElement.scrollHeight, top + innerHeight)
    // It crosses what is on screen as the trip starts. That box is fixed on the
    // page from then on, so a scroll carries the bit off with the text.
    const flight = plan(config, seed, { x: [0, width - size], y: [top, bottom - size] })

    // The canvas is that box, one of its pixels to a CSS pixel, which clips the
    // bit as it comes in and goes out. Setting its size also clears it.
    canvas.style.top = `${top}px`
    canvas.style.width = `${width}px`
    canvas.style.height = `${bottom - top}px`
    canvas.width = width
    canvas.height = bottom - top
    canvas.hidden = false
    canvas.dispatchEvent(new CustomEvent('bit:fly', { detail: seed }))

    const lead = green(config.lead)
    const trail = green(config.trail)
    // Until the brightest of it has dimmed below the last step of 255.
    const lifespan = (Math.log(1 / 255) / Math.log(1 - fade)) * TICK

    /** The box from one point to another, in whole canvas pixels. */
    const span = (a: Point, b: Point) => {
      const left = Math.round(Math.min(a.x, b.x))
      const right = Math.round(Math.max(a.x, b.x))
      const high = Math.round(Math.min(a.y, b.y))
      const low = Math.round(Math.max(a.y, b.y))
      context.fillRect(left, high - top, right - left + size, low - high + size)
    }

    let begun: number | undefined
    let drawn = 0
    let dimmed = 0
    const tick = (now: number) => {
      begun ??= now
      const time = now - begun

      if (time - dimmed >= DIM_EVERY) {
        context.globalCompositeOperation = 'destination-out'
        context.globalAlpha = 1 - (1 - fade) ** ((time - dimmed) / TICK)
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.globalCompositeOperation = 'source-over'
        context.globalAlpha = 1
        dimmed = time
      }

      if (drawn < flight.duration) {
        const to = Math.min(time, flight.duration)
        const path = trace(flight, drawn, to)
        context.fillStyle = trail
        for (let i = 1; i < path.length; i++) span(path[i - 1]!, path[i]!)
        context.fillStyle = lead
        span(path.at(-1)!, path.at(-1)!)
        drawn = to
      }

      if (time < flight.duration + lifespan) {
        frame = requestAnimationFrame(tick)
      } else {
        land()
        schedule()
      }
    }
    frame = requestAnimationFrame(tick)
    return seed
  }

  schedule()
  // A hidden tab gets no frames, and the first one back would draw the rest of
  // the trip as one line, so the trip ends there.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) land()
    resume()
  })
  reduced.addEventListener('change', resume)

  return {
    get config() {
      return config
    },
    /** Retunes in place; the next launch flies the new settings. */
    configure(next: BitConfig) {
      config = parseBitConfig(next)
    },
    fly,
  }
}

export const bit = canvas && context ? start(canvas, context) : undefined
