/**
 * "Show more" (ui/ShowMore.astro) unfolds the rows of its section marked
 * `data-folded` and then removes itself. The rows arrive hidden, so nothing
 * flashes before this runs; with scripts off, the noscript in Base.astro shows
 * them and hides the button instead.
 *
 * The list springs open on the page's spring, with no bounce: the curve comes on
 * the button, worked out at build time. The button goes in the same frame, so
 * the list starts from the height that leaves whatever follows it where it was,
 * and only then pushes it down. Under reduced motion the rows are simply there.
 *
 * Each row enters one after another rather than all at once. The row only asks;
 * scroll-reveal.ts owns those animations and plays them in turn.
 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

/** How far `below` sits from the top of `list`: the list's share of the layout. */
const reach = (list: HTMLElement, below: Element | null | undefined) =>
  below ? below.getBoundingClientRect().top - list.getBoundingClientRect().top : list.offsetHeight

for (const button of document.querySelectorAll<HTMLElement>('[data-show-more]')) {
  const section = button.closest('section') ?? document
  const rows = section.querySelectorAll('[data-folded]')
  const wrapper = button.closest('[data-show-more-row]')
  const list = rows[0]?.parentElement
  const spring = { duration: Number(button.dataset.duration), easing: button.dataset.easing }

  button.addEventListener('click', () => {
    const below = wrapper?.nextElementSibling
    const before = list ? reach(list, below) : 0

    wrapper?.remove()
    rows.forEach((row, index) => {
      row.removeAttribute('data-folded')
      row.dispatchEvent(new CustomEvent('reveal:enter', { bubbles: true, detail: index * 80 }))
    })

    if (!list || reduced.matches) return

    // Measured from the list's own top, so it comes out right wherever the list
    // sits on the page.
    const height = list.offsetHeight
    const from = height - (reach(list, below) - before)
    list.style.overflow = 'clip'
    list
      .animate([{ height: `${from}px` }, { height: `${height}px` }], spring)
      .finished.finally(() => list.style.removeProperty('overflow'))
      .catch(() => {
        // nothing cancels it, but a rejection should not reach the console
      })
  })
}

// A module, so its helpers do not land in the page's global scope.
export {}
