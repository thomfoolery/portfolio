/**
 * The dev-only ASCII art editor.
 *
 * ArtHtml renders each art block with a `data-art-frame` wrapper in dev; this
 * module hangs a trigger on it and, on click, edits the block's two arrays —
 * characters and colours — in a full-screen overlay. Save posts them to the dev
 * server, which writes the block's JSON.
 *
 * Both palettes are live at once, so the tool decides what a click on the grid
 * does: stamp a glyph, recolour one that is already there, sample a cell, or
 * blank it. `0`-`9` pick a colour, `e` and `shift+e` sample a cell's glyph or its
 * colour, and `d` takes the eraser.
 *
 * It is loaded from Base.astro behind `import.meta.env.DEV`, so it never reaches
 * a build and nothing here ships.
 */
import { COLORS, bounds, parse, resize } from '@/lib/art'
import './editor.css'

const TEXTURES = ['░', '▒', '▓', '█', '▀', '▄', '▌', '▐', '·']
/** Swatch order, and the order the `0`-`9` hotkeys follow. `null` is the section's own colour. */
const STEPS = [null, ...COLORS]
const TOOLS = ['texture', 'colour', 'eyedropper', 'eraser']
/** What the eyedropper takes, and what its button says while it will take it. */
const PICKS = { both: 'eyedropper', texture: 'pick texture', colour: 'pick colour' }
/** The keys: `e` samples one facet, `shift+e` the other, and the button takes both. */
const TOOL_HINTS = { eyedropper: 'e glyph, shift+e colour', eraser: 'd' }
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
      <h2>tool <span class="ae-hint">e / shift+e / d</span></h2>
      <div class="ae-tools" data-tools></div>
      <h2>character</h2>
      <div class="ae-swatches" data-textures></div>
      <h2>colour <span class="ae-hint">0-9</span></h2>
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

function setColor(art, row, col, color) {
  const colors = art.colors[row]
  while (colors.length <= col) colors.push(null)
  colors[col] = color
}

function open(frame) {
  const pre = frame.querySelector('pre')
  if (!pre) return

  const path = frame.dataset.artPath ?? ''
  let art = parse(pre.outerHTML)
  let tool = 'texture'
  let pick = 'both'
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
    dims.textContent = `${cols} x ${rows}`
    colsInput.value = String(cols)
    rowsInput.value = String(rows)
  }

  // --- palette
  const swatch = (label, title, onPick, color) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ae-swatch'
    button.textContent = label
    button.title = title
    button.setAttribute('aria-pressed', 'false')
    if (color !== undefined) button.style.color = color
    button.addEventListener('click', onPick)
    return button
  }

  const toolButtons = TOOLS.map((name) => {
    const hint = TOOL_HINTS[name]
    const button = swatch(name, `tool: ${name}${hint ? ` (${hint})` : ''}`, () => selectTool(name))
    button.dataset.tool = name
    $('[data-tools]').append(button)
    return button
  })

  const textureButtons = TEXTURES.map((char) => {
    return swatch(
      char,
      `character: ${char}`,
      () => {
        texture = char
        tool = 'texture'
        syncPalette()
      },
      'var(--color-green-900)',
    )
  })
  $('[data-textures]').append(...textureButtons)

  const colorButtons = STEPS.map((step, index) =>
    swatch(
      String(index),
      step ? `colour: ${step}` : 'colour: pre (inherited)',
      () => pickColor(index),
      colorVar(step) || 'var(--color-green-600)',
    ),
  )
  $('[data-colors]').append(...colorButtons)

  function selectTool(name, pickWith) {
    tool = name
    if (name === 'eyedropper') pick = pickWith ?? 'both'
    syncPalette()
  }

  function pickColor(index) {
    color = STEPS[index] ?? null
    tool = 'colour'
    syncPalette()
  }

  function syncPalette() {
    for (const button of toolButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === tool))
      // The eyedropper says which facet a click on the grid will take.
      if (button.dataset.tool === 'eyedropper') button.textContent = PICKS[pick]
    }
    textureButtons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(TEXTURES[i] === texture))
    })
    colorButtons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(STEPS[i] === color))
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
  const applyAt = (cell) => {
    const row = Number(cell.dataset.row)
    const col = Number(cell.dataset.col)
    const char = art.chars[row]?.[col] ?? ' '

    if (tool === 'texture') {
      setChar(art, row, col, texture)
    } else if (tool === 'colour') {
      if (char === ' ') return // colour paints glyphs that are there
      setColor(art, row, col, color)
    } else if (tool === 'eyedropper') {
      if (pick !== 'colour' && char !== ' ') texture = char // a blank cell holds no glyph
      if (pick !== 'texture') color = art.colors[row]?.[col] ?? null
      syncPalette()
    } else {
      setChar(art, row, col, ' ')
      setColor(art, row, col, null)
    }
    paintCell(cell, row, col)
  }

  const paintAt = (event) => {
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('.ae-cell')
    if (cell) applyAt(cell)
  }

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

  // --- keys
  // Capture, on the document: the nav's global hotkeys listen for bare keys in
  // the bubble phase and would otherwise scroll the page behind the overlay.
  const onKey = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const target = event.target
    const field =
      target instanceof Element && target.closest('input, textarea, select, [contenteditable]')
    if (field) {
      event.stopPropagation() // the field keeps the key; the page behind keeps still
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
      return
    }
    const key = event.key.toLowerCase()
    if (!event.repeat && /^[0-9]$/.test(event.key)) {
      event.preventDefault()
      pickColor(Number(event.key))
    } else if (!event.repeat && key === 'e') {
      event.preventDefault()
      selectTool('eyedropper', event.shiftKey ? 'colour' : 'texture')
    } else if (!event.repeat && key === 'd') {
      event.preventDefault()
      selectTool('eraser')
    }
    // Everything else stays out of the page behind. These three are left alone so
    // a focused swatch still activates: stopping an event in the capture phase
    // keeps it from reaching the element the key was aimed at.
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Tab') event.stopPropagation()
  }

  // --- close, cancel, save
  function close() {
    document.removeEventListener('keydown', onKey, true)
    window.removeEventListener('pointerup', stopPainting)
    overlay.remove()
    document.body.style.overflow = ''
    frame.querySelector('.ae-trigger')?.focus()
  }

  async function save() {
    status.textContent = 'saving...'
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
  document.addEventListener('keydown', onKey, true)
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
