/**
 * The dev-only ASCII art editor.
 *
 * ArtHtml renders each art block with a `data-art-frame` wrapper in dev; this
 * module hangs a trigger on it and, on click, edits the block's two arrays —
 * characters and colours — in a full-screen overlay. Save posts them to the dev
 * server, which writes the block's JSON.
 *
 * It is loaded from Base.astro behind `import.meta.env.DEV`, so it never reaches
 * a build and nothing here ships.
 */
import { COLORS, bounds, parse, resize } from '@/lib/art'
import './editor.css'

const TEXTURES = ['░', '▒', '▓', '█', '▀', '▄', '▌', '▐', '·', ' ']
const ENDPOINT = '/__art-editor/save'
const DEFAULT_COLOR = COLORS[3]

const CHROME = `
  <header class="ae-bar">
    <span class="ae-title" data-path></span>
    <span class="ae-dims" data-dims></span>
    <span class="ae-status" data-status></span>
    <button class="ae-button" data-close type="button" aria-label="Close">×</button>
  </header>
  <div class="ae-body">
    <div class="ae-stage"><div class="ae-canvas" data-canvas></div></div>
    <aside class="ae-palette">
      <div class="ae-modes">
        <button class="ae-button" data-mode="texture" type="button" aria-pressed="true">texture</button>
        <button class="ae-button" data-mode="color" type="button" aria-pressed="false">color</button>
      </div>
      <h2 data-textures-title>character</h2>
      <div class="ae-swatches" data-textures></div>
      <h2 data-colors-title>colour</h2>
      <div class="ae-swatches" data-colors></div>
      <h2>size</h2>
      <div class="ae-size">
        <label>cols <input type="number" min="1" max="400" step="1" data-cols /></label>
        <label>rows <input type="number" min="1" max="200" step="1" data-rows /></label>
      </div>
      <div class="ae-actions">
        <button class="ae-button" data-save type="button">Save</button>
        <button class="ae-button" data-cancel type="button">Cancel</button>
      </div>
    </aside>
  </div>`

const colorVar = (color) => (color ? `var(--color-${color})` : '')

/** Write a character, growing a ragged row rather than leaving holes in it. */
function setChar(art, row, col, char) {
  const chars = art.chars[row]
  const colors = art.colors[row]
  while (chars.length < col) {
    chars.push(' ')
    colors.push(null)
  }
  chars[col] = char
  if (colors.length <= col) colors[col] = null
}

function open(frame) {
  const pre = frame.querySelector('pre')
  if (!pre) return

  const path = frame.dataset.artPath ?? ''
  let art = parse(pre.outerHTML)
  let mode = 'texture'
  let texture = TEXTURES[0]
  let color = DEFAULT_COLOR
  let painting = false

  const overlay = document.createElement('div')
  overlay.className = 'ae-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', `Edit ${path}`)
  overlay.setAttribute('tabindex', '-1')
  overlay.innerHTML = CHROME

  const $ = (selector) => overlay.querySelector(selector)
  const canvas = $('[data-canvas]')
  const dims = $('[data-dims]')
  const status = $('[data-status]')
  const colsInput = $('[data-cols]')
  const rowsInput = $('[data-rows]')
  $('[data-path]').textContent = path

  const paintCell = (cell, row, col) => {
    cell.textContent = art.chars[row]?.[col] ?? ' '
    cell.style.color = colorVar(art.colors[row]?.[col] ?? null)
  }

  const draw = () => {
    const { cols, rows } = bounds(art)
    canvas.style.gridTemplateColumns = `repeat(${cols}, 1ch)`
    const cells = document.createDocumentFragment()
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const cell = document.createElement('span')
        cell.className = 'ae-cell'
        cell.dataset.row = String(row)
        cell.dataset.col = String(col)
        paintCell(cell, row, col)
        cells.append(cell)
      }
    }
    canvas.replaceChildren(cells)
    dims.textContent = `${cols} × ${rows}`
    colsInput.value = String(cols)
    rowsInput.value = String(rows)
  }

  const paintAt = (event) => {
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('.ae-cell')
    if (!cell) return
    const row = Number(cell.dataset.row)
    const col = Number(cell.dataset.col)

    if (mode === 'texture') {
      setChar(art, row, col, texture)
    } else {
      const char = art.chars[row]?.[col]
      if (char == null || char === ' ') return // colour paints glyphs that are there
      const colors = art.colors[row]
      while (colors.length <= col) colors.push(null)
      colors[col] = color
    }
    paintCell(cell, row, col)
  }

  // --- palette
  const swatch = (label, active, onPick, style) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ae-swatch'
    button.textContent = label
    button.title = label
    button.setAttribute('aria-pressed', String(active))
    Object.assign(button.style, style)
    button.addEventListener('click', onPick)
    return button
  }

  const syncPalette = () => {
    for (const button of overlay.querySelectorAll('[data-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode))
    }
    $('[data-textures-title]').hidden = mode !== 'texture'
    $('[data-textures]').hidden = mode !== 'texture'
    $('[data-colors-title]').hidden = mode !== 'color'
    $('[data-colors]').hidden = mode !== 'color'
  }

  const textures = $('[data-textures]')
  const colors = $('[data-colors]')

  for (const char of TEXTURES) {
    const label = char === ' ' ? '␣' : char
    const button = swatch(label, char === texture, () => {
      texture = char
      mode = 'texture'
      rebuildPalette()
    })
    button.style.color = 'var(--color-green-900)'
    textures.append(button)
  }

  for (const step of [null, ...COLORS]) {
    const button = swatch(step ? step.replace('green-', '') : 'pre', step === color, () => {
      color = step
      mode = 'color'
      rebuildPalette()
    })
    button.style.color = colorVar(step) || 'var(--color-green-600)'
    colors.append(button)
  }

  function rebuildPalette() {
    const textureChildren = [...textures.children]
    TEXTURES.forEach((char, i) =>
      textureChildren[i].setAttribute('aria-pressed', String(char === texture)),
    )
    const colorChildren = [...colors.children]
    ;[null, ...COLORS].forEach((step, i) =>
      colorChildren[i].setAttribute('aria-pressed', String(step === color)),
    )
    syncPalette()
  }

  for (const button of overlay.querySelectorAll('[data-mode]')) {
    button.addEventListener('click', () => {
      mode = button.dataset.mode
      syncPalette()
    })
  }
  syncPalette()

  // --- size
  const applySize = () => {
    const cols = Math.min(400, Math.max(1, Number(colsInput.value) || 1))
    const rows = Math.min(200, Math.max(1, Number(rowsInput.value) || 1))
    art = resize(art, cols, rows)
    draw()
  }
  colsInput.addEventListener('change', applySize)
  rowsInput.addEventListener('change', applySize)

  // --- painting
  const stopPainting = () => {
    painting = false
  }
  canvas.addEventListener('pointerdown', (event) => {
    painting = true
    paintAt(event)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (painting) paintAt(event)
  })
  window.addEventListener('pointerup', stopPainting)

  // --- close, cancel, save
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  function close() {
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('pointerup', stopPainting)
    overlay.remove()
    document.body.style.overflow = ''
    frame.querySelector('.ae-trigger')?.focus()
  }

  async function save() {
    status.textContent = 'saving…'
    status.removeAttribute('data-error')
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path, chars: art.chars, colors: art.colors }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? response.statusText)
      close()
    } catch (error) {
      status.setAttribute('data-error', '')
      status.textContent = `save failed: ${error.message}`
    }
  }

  $('[data-close]').addEventListener('click', close)
  $('[data-cancel]').addEventListener('click', close)
  $('[data-save]').addEventListener('click', save)

  draw()
  document.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
  document.body.append(overlay)
  overlay.focus()
}

function mount(frame) {
  if (frame.querySelector('.ae-trigger')) return
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'ae-trigger'
  trigger.textContent = '✎'
  trigger.title = 'Edit this ASCII art'
  trigger.setAttribute('aria-label', 'Edit this ASCII art')
  trigger.addEventListener('click', () => open(frame))
  frame.append(trigger)
}

for (const frame of document.querySelectorAll('[data-art-frame]')) mount(frame)
