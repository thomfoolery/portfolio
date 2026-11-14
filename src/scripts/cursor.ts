/**
 * Moves the caret in Cursor.astro and hides the native pointer. Only a mouse or a
 * pen gets it: on a touch screen there is no pointer to replace, and the block
 * would sit wherever the last tap landed.
 */
const caret = document.querySelector<HTMLElement>('[data-caret]')

if (caret && matchMedia('(pointer: fine)').matches) {
  document.documentElement.dataset.cursor = ''

  let x = -100
  let y = -100
  let frame = 0
  let resting: ReturnType<typeof setTimeout> | undefined

  const draw = () => {
    frame = 0
    caret.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }

  addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return

      x = event.clientX
      y = event.clientY
      caret.dataset.visible = ''
      caret.dataset.typing = ''

      clearTimeout(resting)
      resting = setTimeout(() => {
        delete caret.dataset.typing
      }, 400)

      if (!frame) frame = requestAnimationFrame(draw)
    },
    { passive: true },
  )

  // Gone from the window, so the caret goes with it.
  document.addEventListener('pointerout', (event) => {
    if (event.relatedTarget) return
    delete caret.dataset.visible
  })

  document.addEventListener('pointerenter', () => {
    caret.dataset.visible = ''
  })
}
