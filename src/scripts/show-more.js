// "Show more" reveals the rows marked data-more and then removes itself. The
// server renders every row, so with the script off the whole list is visible:
// the button is hidden until this runs.
for (const button of document.querySelectorAll('[data-show-more]')) {
  const section = button.closest('section') ?? document
  const rows = section.querySelectorAll('[data-more]')
  const wrapper = button.parentElement

  for (const row of rows) row.hidden = true
  wrapper.hidden = false

  button.addEventListener('click', () => {
    for (const row of rows) row.hidden = false
    wrapper.remove()
  })
}
