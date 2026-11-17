/**
 * The Work carousel's tiles: each plays its loop while it is on screen, and
 * enlarges when it is clicked. Under them, prev and next step the carousel to
 * the neighbouring snap, smoothly unless motion is reduced.
 *
 * A loop pauses scrolled away, in a hidden tab, or under
 * `prefers-reduced-motion`, where it never starts and the poster stands in. The
 * tiles are `preload="none"`, so a loop is only fetched the first time it plays.
 *
 * Enlarged, the tile's own video moves into the overlay, so it keeps playing
 * and nothing is fetched again, and zooms there from the tile with a transform
 * on the page's spring. It is the one loop that plays while it is enlarged,
 * under reduced motion too, since the click asked for it; there the zoom is
 * instant. A click anywhere, Esc or Tab zooms it back to wherever its tile is by
 * then, and focus goes back to the tile.
 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const videos = document.querySelectorAll<HTMLVideoElement>('[data-work-video]')
const overlay = document.querySelector<HTMLElement>('[data-work-zoom]')
const backdrop = overlay?.querySelector<HTMLElement>('[data-work-backdrop]')
/** The tiles the observer last saw on screen, the carousel's own scroll included. */
const seen = new Set<Element>()
/** The enlarged tile and its video, from the click until it is back. */
let zoomed: { tile: HTMLElement; video: HTMLVideoElement; closing: boolean } | undefined

const tend = () => {
  for (const video of videos) {
    const wanted =
      !document.hidden && (zoomed ? video === zoomed.video : seen.has(video) && !reduced.matches)
    if (wanted) {
      // A play the browser refuses, or a pause that cuts it short, leaves the
      // poster showing, which is the tile's fallback anyway.
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }
}

const sight = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    if (isIntersecting) seen.add(target)
    else seen.delete(target)
  }
  tend()
})
for (const video of videos) sight.observe(video)
document.addEventListener('visibilitychange', tend)
reduced.addEventListener('change', tend)

/** The transform that puts the box `at` over the box `over`: both are 16:9. */
const onto = (over: DOMRect, at: DOMRect) =>
  `translate(${over.left - at.left}px, ${over.top - at.top}px) scale(${over.width / at.width})`

if (overlay && backdrop) {
  const spring = { duration: Number(overlay.dataset.duration), easing: overlay.dataset.easing }

  const open = (tile: HTMLElement, video: HTMLVideoElement) => {
    if (zoomed) return
    zoomed = { tile, video, closing: false }
    const from = tile.getBoundingClientRect()

    overlay.setAttribute('aria-label', video.getAttribute('aria-label') ?? '')
    overlay.hidden = false
    overlay.append(video)
    overlay.focus({ preventScroll: true })
    tend()

    if (reduced.matches) return
    video.animate(
      [{ transform: onto(from, video.getBoundingClientRect()) }, { transform: 'none' }],
      spring,
    )
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], spring)
  }

  const close = () => {
    if (!zoomed || zoomed.closing) return
    const shown = zoomed
    shown.closing = true
    shown.tile.focus({ preventScroll: true })

    const done = () => {
      // Back under the tint, not over it: appending would put the video last and
      // the tile would come back gray with the green behind it.
      const tint = shown.tile.querySelector('[data-work-tint]')
      shown.tile.insertBefore(shown.video, tint)
      overlay.hidden = true
      for (const animation of [...shown.video.getAnimations(), ...backdrop.getAnimations()]) {
        animation.cancel()
      }
      zoomed = undefined
      tend()
    }
    if (reduced.matches) {
      done()
      return
    }

    // From wherever an opening zoom has got to, so a quick Esc reverses it
    // rather than jumping to full size first.
    const transform = getComputedStyle(shown.video).transform
    const opacity = getComputedStyle(backdrop).opacity
    for (const animation of [...shown.video.getAnimations(), ...backdrop.getAnimations()]) {
      animation.cancel()
    }
    const to = onto(shown.tile.getBoundingClientRect(), shown.video.getBoundingClientRect())
    const settle = { ...spring, fill: 'forwards' } as const
    backdrop.animate([{ opacity }, { opacity: 0 }], settle)
    shown.video.animate([{ transform }, { transform: to }], settle).finished.then(done, () => {})
  }

  for (const tile of document.querySelectorAll<HTMLElement>('[data-work-tile]')) {
    const video = tile.querySelector('video')
    if (video) tile.addEventListener('click', () => open(tile, video))
  }
  overlay.addEventListener('click', close)
  document.addEventListener('keydown', (event) => {
    if (!zoomed || zoomed.closing || (event.key !== 'Escape' && event.key !== 'Tab')) return
    // Tab closes rather than leaving: focus goes back to the tile, and the next
    // Tab carries on from there.
    event.preventDefault()
    close()
  })
}

const scroller = document.querySelector<HTMLElement>('[data-work-tiles]')
const steps = document.querySelectorAll<HTMLElement>('[data-work-step]')

if (scroller) {
  /** Where a step scrolls to, from where the last one was headed until it lands. */
  let heading: number | undefined

  /**
   * Where the carousel comes to rest for each tile: snapped to its start, as its
   * scroll margin places it, and no further than the scroll can go. Only these:
   * the very ends are not snaps, and a step there would snap straight back.
   */
  const stops = () => {
    const end = scroller.scrollWidth - scroller.clientWidth
    const edge = scroller.getBoundingClientRect().left - scroller.scrollLeft
    return [...scroller.children].map((tile) => {
      const margin = parseFloat(getComputedStyle(tile).scrollMarginLeft)
      return Math.max(0, Math.min(end, tile.getBoundingClientRect().left - edge - margin))
    })
  }

  /**
   * The next stop one way, from where a step is already headed, so two quick
   * presses go two tiles. None at either end.
   */
  const toward = (forward: boolean) => {
    const from = heading ?? scroller.scrollLeft
    const all = stops()
    return forward ? all.find((stop) => stop > from + 1) : all.findLast((stop) => stop < from - 1)
  }

  /** Dims a step with nowhere to go. */
  const mark = () => {
    if (heading !== undefined && Math.abs(scroller.scrollLeft - heading) < 1) heading = undefined
    for (const button of steps) {
      const blocked = toward(button.dataset.workStep === '1') === undefined
      button.setAttribute('aria-disabled', String(blocked))
    }
  }

  for (const button of steps) {
    button.addEventListener('click', () => {
      const to = toward(button.dataset.workStep === '1')
      if (to === undefined) return
      heading = to
      scroller.scrollTo({ left: to, behavior: reduced.matches ? 'instant' : 'smooth' })
      mark()
    })
  }

  scroller.addEventListener('scroll', mark, { passive: true })
  scroller.addEventListener('scrollend', () => {
    heading = undefined
    mark()
  })
  addEventListener('resize', mark)
  mark()
}

// A module, so its helpers do not land in the page's global scope.
export {}
