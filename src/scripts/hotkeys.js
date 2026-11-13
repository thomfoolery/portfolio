// Nav hotkeys: a bare keypress clicks the nav link with a matching data-key.
// Inlined into each page at build time, so it costs no request.
document.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]'))
    return
  const link = document.querySelector(`nav a[data-key="${event.key.toLowerCase()}"]`)
  if (!link) return
  event.preventDefault()
  link.click()
})
