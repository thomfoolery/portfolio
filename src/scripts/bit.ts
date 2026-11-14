import { parseBitConfig, plan, randomSeed } from '@/lib/bit'
import type { BitConfig } from '@/lib/bit'
import settings from '@/data/bit.json'

/**
 * Flies the stray bit in Bit.astro, every `gap` ms, on a path `lib/bit.ts`
 * plans from a fresh seed. Positions are page coordinates, so the bit stays
 * where it is on the page when you scroll.
 *
 * The lead span is in the markup; the followers are made here at launch, one
 * per `followers`, and play the same keyframes `lag` ms apart, fading, which
 * draws the trail along the exact path, turns included. They are removed when
 * the trip lands, so between trips there is one hidden span and no layers.
 *
 * Only a fine pointer gets it, as with the caret: on a phone it is a lot of
 * moving parts for a dot too small to notice.
 *
 * `bit` is exported for the dev-only lab, which retunes and relaunches it in
 * place. Each launch says so with a `bit:fly` event on the layer.
 */
const layer = document.querySelector<HTMLElement>('[data-bit-layer]')
const lead = layer?.querySelector<HTMLElement>('[data-bit]')
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

function start(layer: HTMLElement, lead: HTMLElement) {
  let config = parseBitConfig(settings)
  let spans = [lead]
  let flights: Animation[] = []
  let timer: ReturnType<typeof setTimeout> | undefined

  /** Size and colours, which the lead and every follower read from the layer. */
  const draw = () => {
    layer.style.setProperty('--bit-size', `${config.size}px`)
    layer.style.setProperty('--bit-lead', `var(--color-green-${config.lead})`)
    layer.style.setProperty('--bit-trail', `var(--color-green-${config.trail})`)
  }

  /** The trail for one trip, faded from the lead back. */
  const muster = () => {
    const count = config.followers + 1
    const trail = Array.from({ length: config.followers }, () => {
      const follower = lead.cloneNode() as HTMLElement
      follower.classList.add('trail')
      return follower
    })
    spans = [lead, ...trail]
    spans.forEach((span, i) => {
      span.style.opacity = String((1 - i / count) ** config.fade)
    })
    layer.append(...trail)
  }

  const land = () => {
    for (const flight of flights) flight.cancel()
    flights = []
    for (const follower of spans.slice(1)) follower.remove()
    spans = [lead]
    delete layer.dataset.flying
    layer.style.height = ''
  }

  const schedule = () => {
    clearTimeout(timer)
    const [min, max] = config.gap
    timer = setTimeout(
      () => {
        // Nobody is watching a hidden tab, and a reduced-motion reader asked not to.
        if (document.hidden || reduced.matches) schedule()
        else fly()
      },
      min + Math.random() * (max - min),
    )
  }

  const fly = (seed = randomSeed()) => {
    clearTimeout(timer)
    land()

    const height = document.documentElement.scrollHeight
    const size = { x: lead.offsetWidth, y: lead.offsetHeight }
    // It crosses what is on screen as the trip starts. That box is fixed on the
    // page from then on, so a scroll carries the bit off with the text.
    const { keyframes, duration } = plan(config, seed, {
      box: {
        x: [0, document.documentElement.clientWidth - size.x],
        y: [scrollY, Math.min(height, scrollY + innerHeight) - size.y],
      },
      size,
    })

    muster()
    layer.style.height = `${height}px`
    layer.dataset.flying = ''
    layer.dispatchEvent(new CustomEvent('bit:fly', { detail: seed }))

    const mine = spans.map((span, i) =>
      span.animate(keyframes, { duration, delay: i * config.lag, easing: 'linear', fill: 'both' }),
    )
    flights = mine

    // A relaunch cancels these, which rejects `finished`: that trip is over and
    // the new one owns the schedule.
    Promise.all(mine.map((flight) => flight.finished)).then(
      () => {
        land()
        schedule()
      },
      () => {},
    )
    return seed
  }

  draw()
  schedule()

  return {
    get config() {
      return config
    },
    /** Retunes in place; the next launch flies the new settings. */
    configure(next: BitConfig) {
      config = parseBitConfig(next)
      draw()
    },
    fly,
  }
}

export const bit =
  layer && lead && matchMedia('(pointer: fine)').matches ? start(layer, lead) : undefined
