/**
 * The disclosure's open and close: the page's spring (`lib/spring`), with no
 * bounce, on the height and the fade together. Disclosure.astro works the curve
 * out at build time and hands it over on the element as `data-duration` and
 * `data-easing`, so this script ships without the spring solver.
 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

/**
 * With reduced motion the panel arrives at its full height and only the fade
 * runs: the state change survives, the travel does not.
 */
const FADE = 150

for (const details of document.querySelectorAll<HTMLDetailsElement>('details[data-disclosure]')) {
  const summary = details.querySelector('summary')
  const panel = details.querySelector<HTMLElement>('[data-disclosure-panel]')
  if (!summary || !panel) continue

  const duration = Number(details.dataset.duration)
  const easing = details.dataset.easing

  /** Where the disclosure is heading, so a second gesture can reverse mid-flight. */
  let wanted = details.open
  let animation: Animation | undefined

  const toggle = () => {
    // Idle means the element is the truth; mid-flight, `wanted` is.
    if (!animation || animation.playState !== 'running') wanted = details.open
    const opening = !wanted
    wanted = opening

    animation?.cancel()
    // The height has to be a length, so the content is measured open and handed
    // back to `auto` once it has arrived.
    if (opening) details.open = true

    // The row's line is part of the reveal the scroll drives; an open row shows
    // it whole, and asks for it back when it closes.
    if (opening) details.dispatchEvent(new CustomEvent('reveal:play', { bubbles: true }))

    if (reduced.matches) {
      animation = panel.animate(
        opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
        { duration: FADE, easing: 'linear', fill: 'both' },
      )
    } else {
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
        { duration, easing, fill: 'both' },
      )
    }

    animation.finished
      .then(() => {
        if (!wanted) {
          details.open = false
          details.dispatchEvent(new CustomEvent('reveal:reset', { bubbles: true }))
        }
        animation?.cancel()
      })
      .catch(() => {
        // the next gesture cancelled it
      })
  }

  summary.addEventListener('click', (event) => {
    // The UA would toggle at once; this animates the same toggle instead. Enter
    // and Space arrive here as clicks too.
    event.preventDefault()
    toggle()
  })
}

// A module, so its helpers do not land in the page's global scope.
export {}
