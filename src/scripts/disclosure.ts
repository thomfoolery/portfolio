import { spring } from 'motion'

/**
 * The disclosure's open and close. Motion is asked only for the curve: its
 * spring, sampled into the `linear()` easing a browser animation can run, so the
 * height and the fade are animated by the engine rather than by a frame loop of
 * ours.
 *
 * `bounce: 0` is critically damped — it arrives without overshooting — and
 * `visualDuration` is when it looks arrived, which is also the fade's length.
 */
const CURVE = spring({ keyframes: [0, 1], bounce: 0, visualDuration: 0.2 }).toString()
const DURATION = Number.parseFloat(CURVE)
const EASING = CURVE.replace(/^[\d.]+ms /, '')

/** Long enough that a pointer crossing the list does not open every row it passes. */
const HOVER_DELAY = 250

const reduced = matchMedia('(prefers-reduced-motion: reduce)')
/** A pointer that can rest on a row. Touch only claims to hover for an instant. */
const canHover = matchMedia('(hover: hover)')

for (const details of document.querySelectorAll<HTMLDetailsElement>('details[data-disclosure]')) {
  const summary = details.querySelector('summary')
  const panel = details.querySelector<HTMLElement>('[data-disclosure-panel]')
  if (!summary || !panel) continue

  /** This one is driven by the pointer, so a click does not toggle it. */
  const onHover = details.hasAttribute('data-disclosure-hover') && canHover.matches

  /** Where the disclosure is heading, so a second gesture can reverse mid-flight. */
  let wanted = details.open
  let animation: Animation | undefined
  /** the pending hover open, dropped if the pointer moves on first */
  let hoverTimer: ReturnType<typeof setTimeout> | undefined

  const set = (opening: boolean) => {
    // Idle means the element is the truth; mid-flight, `wanted` is.
    if (!animation || animation.playState !== 'running') wanted = details.open
    if (wanted === opening) return
    wanted = opening

    animation?.cancel()
    // The height has to be a length, so the content is measured open and handed
    // back to `auto` once it has arrived.
    if (opening) details.open = true

    if (reduced.matches) {
      details.open = opening
      return
    }

    const height = panel.offsetHeight
    animation = panel.animate(
      opening
        ? [
            { height: '0px', opacity: 0 },
            { height: `${height}px`, opacity: 1 },
          ]
        : [
            { height: `${height}px`, opacity: 1 },
            { height: '0px', opacity: 0 },
          ],
      { duration: DURATION, easing: EASING, fill: 'both' },
    )

    animation.finished
      .then(() => {
        if (!wanted) details.open = false
        animation?.cancel()
      })
      .catch(() => {
        // the next gesture cancelled it
      })
  }

  const toggle = () => {
    if (!animation || animation.playState !== 'running') wanted = details.open
    set(!wanted)
  }

  summary.addEventListener('click', (event) => {
    // The UA would toggle on its own; every path below decides for itself.
    event.preventDefault()
    clearTimeout(hoverTimer)

    // In hover mode the pointer has already said what it wants. A click with no
    // pointer behind it (`detail` 0) is Enter or Space, which still toggles, so
    // the row stays reachable from the keyboard.
    if (onHover && event.detail > 0) return

    toggle()
  })

  if (onHover) {
    // Bound to the element, not the summary: opening moves the pointer's target
    // into the content, and leaving the summary would close it again.
    details.addEventListener('pointerenter', () => {
      clearTimeout(hoverTimer)
      hoverTimer = setTimeout(() => set(true), HOVER_DELAY)
    })
    // A pointer that has only passed through never opens the row; one that
    // leaves an open row closes it at once.
    details.addEventListener('pointerleave', () => {
      clearTimeout(hoverTimer)
      set(false)
    })
  }
}
