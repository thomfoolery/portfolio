// "Show more" reveals the rows marked data-more and then removes itself. The
// server renders every row, so with the script off the whole list is visible:
// the button is hidden until this runs.
//
// Each row enters one after another rather than all at once. The row only asks;
// scroll-reveal.ts owns the animations and plays them in turn.
for (const button of document.querySelectorAll('[data-show-more]')) {
  const section = button.closest('section') ?? document
  const rows = section.querySelectorAll('[data-more]')
  const wrapper = button.parentElement

  for (const row of rows) row.hidden = true
  wrapper.hidden = false

  button.addEventListener('click', () => {
    wrapper.remove()
    rows.forEach((row, index) => {
      row.hidden = false
      row.dispatchEvent(new CustomEvent('reveal:enter', { bubbles: true, detail: index * 80 }))
    })
  })
}
