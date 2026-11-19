/**
 * The Work carousel's tiles: each is its poster as tinted pixels, and enlarges
 * when it is clicked. Under them, prev and next step the carousel to the
 * neighbouring snap, smoothly unless motion is reduced.
 *
 * Only an enlarged tile plays its loop, and not in a hidden tab. The videos are
 * `preload="none"`, so a loop is fetched the first time its tile is enlarged.
 *
 * Enlarged, the tile's frame — its pixels, and its video hidden over them —
 * moves into the overlay, so nothing is fetched twice, and zooms there from the
 * tile with a transform on the page's spring. Once it has landed and the loop
 * has a picture, the video fades in over the pixels in its own colour; until
 * then the pixels stand in. A click anywhere, Esc or Tab fades it back out to
 * the pixels, then zooms it back to wherever its tile is by then, and focus goes
 * back to the tile. Under `prefers-reduced-motion` the zoom is instant, and the
 * fades, which move nothing, stay. The loop plays there too, since the click
 * asked for it.
 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const overlay = document.querySelector<HTMLElement>('[data-work-zoom]')
const backdrop = overlay?.querySelector<HTMLElement>('[data-work-backdrop]')
/** The fade between the pixels and the loop, on the tint's old timing. */
const FADE = { duration: 180, easing: 'ease', fill: 'forwards' } as const

interface Zoomed {
  tile: HTMLElement
  frame: HTMLElement
  video: HTMLVideoElement
  closing: boolean
}
/** The enlarged tile, its frame and its video, from the click until it is back. */
let zoomed: Zoomed | undefined

const tend = () => {
  if (!zoomed) return
  // A play the browser refuses leaves the pixels showing, which is the
  // tile's fallback anyway.
  if (document.hidden) zoomed.video.pause()
  else zoomed.video.play().catch(() => {})
}
document.addEventListener('visibilitychange', tend)

/** Settles once the video has a picture to show. */
const pictured = (video: HTMLVideoElement) =>
  new Promise<void>((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) resolve()
    else video.addEventListener('loadeddata', () => resolve(), { once: true })
  })

/** The transform that puts the box `at` over the box `over`: both are one shape. */
const onto = (over: DOMRect, at: DOMRect) =>
  `translate(${over.left - at.left}px, ${over.top - at.top}px) scale(${over.width / at.width})`

if (overlay && backdrop) {
  const spring = { duration: Number(overlay.dataset.duration), easing: overlay.dataset.easing }

  const open = (tile: HTMLElement, frame: HTMLElement, video: HTMLVideoElement) => {
    if (zoomed) return
    const shown: Zoomed = { tile, frame, video, closing: false }
    zoomed = shown
    const from = tile.getBoundingClientRect()

    overlay.setAttribute('aria-label', video.getAttribute('aria-label') ?? '')
    overlay.hidden = false
    overlay.append(frame)
    overlay.focus({ preventScroll: true })
    tend()

    let landed: Promise<unknown> = Promise.resolve()
    if (!reduced.matches) {
      landed = frame.animate(
        [{ transform: onto(from, frame.getBoundingClientRect()) }, { transform: 'none' }],
        spring,
      ).finished
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], spring)
    }
    // A close mid-zoom cancels it, so the fade never starts; a close while the
    // loop is still loading is `closing`.
    Promise.all([landed, pictured(video)]).then(
      () => {
        if (zoomed === shown && !shown.closing)
          video.animate([{ opacity: 0 }, { opacity: 1 }], FADE)
      },
      () => {},
    )
  }

  const close = () => {
    if (!zoomed || zoomed.closing) return
    const shown = zoomed
    shown.closing = true
    shown.tile.focus({ preventScroll: true })

    const done = () => {
      shown.tile.append(shown.frame)
      overlay.hidden = true
      const { frame, video } = shown
      for (const animation of [
        ...frame.getAnimations(),
        ...video.getAnimations(),
        ...backdrop.getAnimations(),
      ]) {
        animation.cancel()
      }
      shown.video.pause()
      zoomed = undefined
    }

    // Back to the pixels first, from wherever the fade-in has got to: nothing
    // to fade if the loop never showed.
    const shade = getComputedStyle(shown.video).opacity
    for (const animation of shown.video.getAnimations()) animation.cancel()
    const faded =
      Number(shade) > 0
        ? shown.video.animate([{ opacity: shade }, { opacity: 0 }], FADE).finished
        : Promise.resolve()

    faded.then(
      () => {
        if (reduced.matches) {
          done()
          return
        }
        // From wherever an opening zoom has got to, so a quick Esc reverses it
        // rather than jumping to full size first.
        const transform = getComputedStyle(shown.frame).transform
        const opacity = getComputedStyle(backdrop).opacity
        for (const animation of [...shown.frame.getAnimations(), ...backdrop.getAnimations()]) {
          animation.cancel()
        }
        const to = onto(shown.tile.getBoundingClientRect(), shown.frame.getBoundingClientRect())
        const settle = { ...spring, fill: 'forwards' } as const
        backdrop.animate([{ opacity }, { opacity: 0 }], settle)
        shown.frame
          .animate([{ transform }, { transform: to }], settle)
          .finished.then(done, () => {})
      },
      () => {},
    )
  }

  for (const tile of document.querySelectorAll<HTMLElement>('[data-work-tile]')) {
    const frame = tile.querySelector<HTMLElement>('[data-work-frame]')
    const video = frame?.querySelector('video')
    if (frame && video) tile.addEventListener('click', () => open(tile, frame, video))
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

  const caption = document.querySelector<HTMLElement>('[data-work-caption]')
  const tiles = [...scroller.children] as HTMLElement[]
  let captioned = 0

  /** The tile the scroller is nearest to, or headed for. */
  const nearest = () => {
    const all = stops()
    const at = heading ?? scroller.scrollLeft
    return all.reduce(
      (best, stop, index) => (Math.abs(stop - at) < Math.abs(all[best]! - at) ? index : best),
      0,
    )
  }

  /**
   * Names the current tile: the old name leaves for the side the carousel is
   * leaving, the new one arrives from the side it is coming from, and both play
   * at once. The outgoing span is taken out of flow so the box — and the row
   * either side of it — keep their size while the two cross, which is what
   * `popLayout` does for `AnimatePresence` in Motion for React. This page has no
   * React, so the same thing is arranged here: absolute exits, in-flow entry.
   */
  const leave = (span: HTMLElement, forward: boolean) => {
    span.style.position = 'absolute'
    span.style.inset = '0'
    span
      .animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: `translateX(${forward ? '-2ch' : '2ch'})`, opacity: 0 },
        ],
        { duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' },
      )
      .finished.then(
        () => span.remove(),
        () => span.remove(),
      )
  }

  const name = () => {
    const index = nearest()
    if (!caption || index === captioned) return

    const forward = index > captioned
    captioned = index
    const title = tiles[index]?.dataset.workTitle ?? ''
    const outgoing = [...caption.children] as HTMLElement[]

    const incoming = document.createElement('span')
    incoming.className = outgoing[0]?.className ?? 'block'
    incoming.textContent = title
    caption.append(incoming)

    if (reduced.matches) {
      for (const span of outgoing) span.remove()
      return
    }

    for (const span of outgoing) leave(span, forward)
    incoming.animate(
      [
        { transform: `translateX(${forward ? '2ch' : '-2ch'})`, opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    )
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

  // One layout read per frame, however many scroll events arrive: both `mark`
  // and `name` measure every tile, and doing it per event was the jank.
  let queued = false
  const sync = () => {
    queued = false
    mark()
    name()
  }
  scroller.addEventListener(
    'scroll',
    () => {
      if (queued) return
      queued = true
      requestAnimationFrame(sync)
    },
    { passive: true },
  )
  scroller.addEventListener('scrollend', () => {
    heading = undefined
    mark()
  })
  addEventListener('resize', mark)
  mark()
}

// A module, so its helpers do not land in the page's global scope.
export {}
