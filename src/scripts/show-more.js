// "Show more" reveals the rows marked data-more and then removes itself. The rows
// arrive hidden, so nothing flashes before this runs; with scripts off, the
// noscript in Base.astro shows them and hides the button instead.
//
// Each row enters one after another rather than all at once. The row only asks;
// scroll-reveal.ts owns the animations and plays them in turn.
for (const button of document.querySelectorAll('[data-show-more]')) {
  const section = button.closest('section') ?? document
  const rows = section.querySelectorAll('[data-more]')
  const wrapper = button.closest('[data-show-more-row]') ?? button.parentElement

  button.addEventListener('click', () => {
    wrapper.remove()
    rows.forEach((row, index) => {
      row.removeAttribute('data-folded')
      row.dispatchEvent(new CustomEvent('reveal:enter', { bubbles: true, detail: index * 80 }))
    })
  })
}
