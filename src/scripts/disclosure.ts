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

const reduced = matchMedia('(prefers-reduced-motion: reduce)')

for (const details of document.querySelectorAll<HTMLDetailsElement>('details[data-disclosure]')) {
  const summary = details.querySelector('summary')
  const panel = details.querySelector<HTMLElement>('[data-disclosure-panel]')
  if (!summary || !panel) continue

  /** Where the disclosure is heading, so a second click can reverse mid-flight. */
  let wanted = details.open
  let animation: Animation | undefined

  summary.addEventListener('click', (event) => {
    // Left alone, the UA toggles instantly, which is what a reader who asked for
    // less motion wants.
    if (reduced.matches) return
    event.preventDefault()

    // Idle means the element is the truth; mid-flight, `wanted` is.
    if (!animation || animation.playState !== 'running') wanted = details.open
    const opening = !wanted
    wanted = opening

    animation?.cancel()

    // The height has to be a length, so the content is measured open and handed
    // back to `auto` once it has arrived.
    if (opening) details.open = true
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
        // the next click cancelled it
      })
  })
}
