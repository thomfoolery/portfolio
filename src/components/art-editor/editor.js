/**
 * The dev-only ASCII art editor.
 *
 * ArtHtml renders each art block with a `data-art-frame` wrapper in dev; this
 * module hangs a trigger on it and, on click, edits the block's two arrays —
 * characters and colours — in a full-screen overlay. Save posts them to the dev
 * server, which writes the block's JSON.
 *
 * Drawing is a pair of toggles rather than a mode: `b` turns painting the brush
 * on and off, `c` the colour, both at once stamps a whole cell, and `tab` walks
 * the three combinations. `0`-`9` pick the ink.
 *
 * The tools take over instead of drawing. `e` samples a cell's brush and ink,
 * `d` blanks cells, `s` draws a box that `x` crops to or that a drag carries
 * somewhere else, and `t` puts a cursor down to type at. With a box up, `b` also
 * turns that area into the brush — a copy, good for stamping until a character
 * is picked again. `cmd+z` and `shift+cmd+z` walk a stack of whole-canvas
 * snapshots, one per stroke, twelve deep.
 *
 * It is loaded from Base.astro behind `import.meta.env.DEV`, so it never reaches
 * a build and nothing here ships.
 */
import { COLORS, bounds, parse, resize } from '@/lib/art'
import './editor.css'

const GLYPHS = ['░', '▒', '▓', '█', '▀', '▄', '▌', '▐', '·']
/** Swatch order, and the order the `0`-`9` hotkeys follow. `null` is the section's own colour. */
const STEPS = [null, ...COLORS]
const FACETS = ['brush', 'colour']
/** What `tab` walks: the brush, the ink, then both at once. */
const FACET_CYCLE = [
  { brush: true, colour: false },
  { brush: false, colour: true },
  { brush: true, colour: true },
]
const TOOLS = ['eyedropper', 'delete', 'select', 'text']
const ENDPOINT = '/__art-editor/save'
const DEFAULT_COLOR = COLORS[3]
/** How many strokes back `cmd+z` reaches. */
const UNDO_LIMIT = 12

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
      <h2>draw <span class="ae-hint">b / c / tab</span></h2>
      <div class="ae-tools" data-draw></div>
      <h2>tool <span class="ae-hint">e / d / s / t</span></h2>
      <div class="ae-tools" data-tools></div>
      <h2>selection <span class="ae-hint">x</span></h2>
      <div class="ae-tools" data-selection></div>
      <h2>brush</h2>
      <div class="ae-swatches" data-brush></div>
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
const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

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
  /** Which of the two things a stroke paints. Both at once stamps a whole cell. */
  const drawing = { brush: true, colour: false }
  let tool = 'draw'
  let glyph = GLYPHS[0]
  let color = DEFAULT_COLOR
  let painting = false
  /** A block lifted out of a selection, which becomes the brush until dropped. */
  let stamp = null
  /** Where the text cursor sits while the text tool is up. */
  let cursor = null
  /** The box the select tool works on, in grid coordinates. */
  let selection = null
  /** Cells lifted out of the art while a selection is being carried. */
  let floating = null
  /** Where a new box started, and where a carry was grabbed. */
  let anchor = null
  let grab = null
  /** The drawn grid's shape, for turning a coordinate back into a cell. */
  let grid = { cols: 0, rows: 0 }

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

  const inSelection = (row, col) =>
    selection != null &&
    row >= selection.top &&
    row <= selection.bottom &&
    col >= selection.left &&
    col <= selection.right

  /** What a cell shows: whatever is floating over it, otherwise the art itself. */
  const cellState = (row, col) => {
    if (floating) {
      const r = row - floating.row
      const c = col - floating.col
      const line = floating.chars[r]
      if (line && c >= 0 && c < line.length) return { char: line[c], color: floating.colors[r][c] }
    }
    return { char: art.chars[row]?.[col] ?? ' ', color: art.colors[row]?.[col] ?? null }
  }

  const paintCell = (cell, row, col) => {
    const state = cellState(row, col)
    cell.textContent = state.char
    cell.style.color = colorVar(state.color)
    cell.classList.toggle('ae-sel', inSelection(row, col))
    cell.classList.toggle(
      'ae-cur',
      tool === 'text' && cursor != null && cursor.row === row && cursor.col === col,
    )
  }

  /** Repaint a rectangle of the grid. Only a move, a stamp or the cursor needs one. */
  const repaintRect = (top, left, bottom, right) => {
    for (let row = Math.max(0, top); row <= Math.min(grid.rows - 1, bottom); row += 1) {
      for (let col = Math.max(0, left); col <= Math.min(grid.cols - 1, right); col += 1) {
        paintCell(canvas.children[row * grid.cols + col], row, col)
      }
    }
  }

  const drawGrid = () => {
    const { cols, rows } = bounds(art)
    grid = { cols, rows }
    if (cursor)
      cursor = { row: clamp(cursor.row, 0, rows - 1), col: clamp(cursor.col, 0, cols - 1) }
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

  // --- history
  // One entry per stroke rather than per cell, and past the limit the oldest
  // falls off. Snapshots are copied on the way in and on the way out, so what a
  // stack holds is never the array the editor is drawing on.
  const snapshot = (source) => ({
    chars: source.chars.map((row) => [...row]),
    colors: source.colors.map((row) => [...row]),
  })
  const undoStack = []
  const redoStack = []

  const remember = () => {
    undoStack.push(snapshot(art))
    if (undoStack.length > UNDO_LIMIT) undoStack.shift()
    redoStack.length = 0 // a fresh edit abandons the redo branch
  }

  const restore = (state) => {
    art = snapshot(state)
    drawGrid() // the size inputs follow, so an undone resize shows its old numbers
  }

  function undoOnce() {
    const state = undoStack.pop()
    if (!state) return
    redoStack.push(snapshot(art))
    if (redoStack.length > UNDO_LIMIT) redoStack.shift()
    restore(state)
  }

  function redoOnce() {
    const state = redoStack.pop()
    if (!state) return
    undoStack.push(snapshot(art))
    if (undoStack.length > UNDO_LIMIT) undoStack.shift()
    restore(state)
  }

  // --- selection
  /** Read a rectangle of the art out as a block of its own. */
  const readBlock = (top, left, bottom, right) => {
    const chars = []
    const colors = []
    for (let row = top; row <= bottom; row += 1) {
      const lineChars = []
      const lineColors = []
      for (let col = left; col <= right; col += 1) {
        lineChars.push(art.chars[row]?.[col] ?? ' ')
        lineColors.push(art.colors[row]?.[col] ?? null)
      }
      chars.push(lineChars)
      colors.push(lineColors)
    }
    return { chars, colors }
  }

  /** Lift the selected cells out of the art, leaving blank the cells behind them. */
  const lift = () => {
    const block = readBlock(selection.top, selection.left, selection.bottom, selection.right)
    for (let row = selection.top; row <= selection.bottom; row += 1) {
      for (let col = selection.left; col <= selection.right; col += 1) {
        setChar(art, row, col, ' ')
        setColor(art, row, col, null)
      }
    }
    floating = { ...block, row: selection.top, col: selection.left }
  }

  /** Put a carried block back down, overwriting whatever is under it. */
  const drop = () => {
    if (!floating) return
    floating.chars.forEach((line, r) => {
      line.forEach((char, c) => {
        setChar(art, floating.row + r, floating.col + c, char)
        setColor(art, floating.row + r, floating.col + c, floating.colors[r][c])
      })
    })
    floating = null
  }

  /** The area becomes the brush. A copy, so the art keeps what it had. */
  const startBrush = () => {
    if (!selection) return
    stamp = readBlock(selection.top, selection.left, selection.bottom, selection.right)
    drawing.brush = true
    setTool('draw') // and that clears the box
  }

  /** The art becomes the selection, and the selection has nothing left to hold. */
  const crop = () => {
    if (!selection) return
    remember()
    drop()
    art = readBlock(selection.top, selection.left, selection.bottom, selection.right)
    selection = null
    drawGrid()
    syncPalette()
  }

  const clearSelection = () => {
    if (!selection) return
    drop() // a block that is mid-carry is never the thing to throw away
    const was = selection
    selection = null
    repaintRect(was.top, was.left, was.bottom, was.right)
    syncPalette()
  }

  // --- text
  const refreshCursor = (was) => {
    if (was) repaintRect(was.row, was.col, was.row, was.col)
    if (cursor) repaintRect(cursor.row, cursor.col, cursor.row, cursor.col)
  }

  const moveCursor = (down, right) => {
    if (!cursor) return
    const was = cursor
    cursor = {
      row: clamp(cursor.row + down, 0, grid.rows - 1),
      col: clamp(cursor.col + right, 0, grid.cols - 1),
    }
    refreshCursor(was)
  }

  const typeChar = (char) => {
    if (!cursor) return
    remember()
    setChar(art, cursor.row, cursor.col, char)
    setColor(art, cursor.row, cursor.col, color)
    const was = cursor
    // Step on, wrapping to the next row, and stay put at the end of the art.
    if (cursor.col + 1 < grid.cols) cursor = { row: cursor.row, col: cursor.col + 1 }
    else if (cursor.row + 1 < grid.rows) cursor = { row: cursor.row + 1, col: 0 }
    refreshCursor(was)
  }

  const backspace = () => {
    if (!cursor) return
    const was = cursor
    // Step back first, then rub out what is under the cursor.
    if (cursor.col > 0) cursor = { row: cursor.row, col: cursor.col - 1 }
    else if (cursor.row > 0) cursor = { row: cursor.row - 1, col: grid.cols - 1 }
    remember()
    setChar(art, cursor.row, cursor.col, ' ')
    setColor(art, cursor.row, cursor.col, null)
    refreshCursor(was)
  }

  /** Text mode owns the keyboard, so the tool hotkeys have to wait their turn. */
  const typeAtCursor = (event) => {
    if (!cursor || tool !== 'text') return false
    if (event.key === 'ArrowUp') moveCursor(-1, 0)
    else if (event.key === 'ArrowDown') moveCursor(1, 0)
    else if (event.key === 'ArrowLeft') moveCursor(0, -1)
    else if (event.key === 'ArrowRight') moveCursor(0, 1)
    else if (event.key === 'Backspace') backspace()
    else if (event.key === 'Enter') {
      const was = cursor
      cursor = { row: Math.min(cursor.row + 1, grid.rows - 1), col: 0 }
      refreshCursor(was)
    } else if (event.key.length === 1) typeChar(event.key)
    else return false
    event.preventDefault()
    event.stopPropagation()
    return true
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

  const action = (label, title, onClick) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ae-button'
    button.textContent = label
    button.title = title
    button.addEventListener('click', onClick)
    return button
  }

  const cropButton = action('crop', 'crop to the selection (x)', crop)
  $('[data-selection]').append(cropButton)

  const stampButton = swatch('area', 'the brush is this area — click to drop it', () => {
    stamp = null
    syncPalette()
  })
  $('[data-brush]').append(stampButton)

  const drawButtons = FACETS.map((facet) => {
    const button = swatch(facet, `draw: ${facet}`, () => toggleDraw(facet))
    button.dataset.facet = facet
    $('[data-draw]').append(button)
    return button
  })

  const toolButtons = TOOLS.map((name) => {
    const button = swatch(name, `tool: ${name}`, () => selectTool(name))
    button.dataset.tool = name
    $('[data-tools]').append(button)
    return button
  })

  const glyphButtons = GLYPHS.map((char) =>
    swatch(
      char,
      `brush: ${char}`,
      () => {
        glyph = char
        stamp = null // picking a character is what makes the area brush temporary
        if (tool === 'text')
          typeChar(char) // clicking a glyph types it
        else {
          drawing.brush = true
          setTool('draw')
        }
        syncPalette()
      },
      'var(--color-green-900)',
    ),
  )
  $('[data-brush]').append(...glyphButtons)

  const colorButtons = STEPS.map((step, index) =>
    swatch(
      String(index),
      step ? `colour: ${step}` : 'colour: pre (inherited)',
      () => pickColor(index),
      colorVar(step) || 'var(--color-green-600)',
    ),
  )
  $('[data-colors]').append(...colorButtons)

  /** Leaving the select tool puts the box away: nothing else knows what to do with it. */
  function setTool(name) {
    const was = tool
    tool = name
    if (name !== 'select') clearSelection()
    if (name === 'text' && !cursor) cursor = { row: 0, col: 0 }
    if (cursor && (was === 'text' || name === 'text')) {
      repaintRect(cursor.row, cursor.col, cursor.row, cursor.col)
    }
    syncPalette()
  }

  function toggleDraw(facet) {
    drawing[facet] = !drawing[facet]
    setTool('draw')
  }

  /** `tab` walks the three ways of drawing, forward or back. */
  function cycleDraw(step) {
    const at = FACET_CYCLE.findIndex(
      (state) => state.brush === drawing.brush && state.colour === drawing.colour,
    )
    const next =
      FACET_CYCLE[(((at + step) % FACET_CYCLE.length) + FACET_CYCLE.length) % FACET_CYCLE.length]
    drawing.brush = next.brush
    drawing.colour = next.colour
    setTool('draw')
  }

  function pickColor(index) {
    color = STEPS[index] ?? null
    drawing.colour = true
    setTool(tool === 'text' ? 'text' : 'draw') // typing wants its ink changed, not its tool
  }

  function selectTool(name) {
    setTool(tool === name ? 'draw' : name) // the button toggles, so it can also get you out
  }

  function syncPalette() {
    for (const button of drawButtons) {
      button.setAttribute('aria-pressed', String(drawing[button.dataset.facet]))
    }
    for (const button of toolButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.tool === tool))
    }
    stampButton.hidden = stamp == null
    stampButton.textContent = stamp ? `area ${bounds(stamp).cols}x${stamp.chars.length}` : 'area'
    stampButton.setAttribute('aria-pressed', String(stamp != null))
    glyphButtons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(stamp == null && GLYPHS[i] === glyph))
    })
    colorButtons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(STEPS[i] === color))
    })
    cropButton.disabled = selection == null
    cropButton.title = selection
      ? `crop to ${selection.right - selection.left + 1} x ${selection.bottom - selection.top + 1} (x)`
      : 'crop to the selection (x)'
  }
  syncPalette()

  // --- size
  const applySize = () => {
    const cols = Math.min(400, Math.max(1, Number(colsInput.value) || 1))
    const rows = Math.min(200, Math.max(1, Number(rowsInput.value) || 1))
    remember()
    clearSelection() // the box was measured against the old shape
    art = resize(art, cols, rows)
    drawGrid()
  }
  colsInput.addEventListener('change', applySize)
  rowsInput.addEventListener('change', applySize)

  // --- painting
  const applyAt = (cell) => {
    const row = Number(cell.dataset.row)
    const col = Number(cell.dataset.col)
    const char = art.chars[row]?.[col] ?? ' '

    if (tool === 'eyedropper') {
      // Takes what drawing would have painted, then gets out of the way. The
      // stroke ends here: a drag must not carry on into drawing.
      if (drawing.brush && char !== ' ') {
        glyph = char // a blank cell holds no glyph
        stamp = null
      }
      if (drawing.colour) color = art.colors[row]?.[col] ?? null
      tool = 'draw'
      painting = false
      syncPalette()
      return
    }

    if (tool === 'delete') {
      setChar(art, row, col, ' ')
      setColor(art, row, col, null)
      paintCell(cell, row, col)
      return
    }

    if (stamp) {
      // The block is the brush, and the cell under the pointer is its top left.
      // Past the edge of the canvas it is cropped, not wrapped.
      const width = bounds(stamp).cols
      stamp.chars.forEach((line, r) => {
        line.forEach((blockChar, c) => {
          const at = { row: row + r, col: col + c }
          if (at.row >= grid.rows || at.col >= grid.cols) return
          if (drawing.brush) {
            setChar(art, at.row, at.col, blockChar)
            setColor(art, at.row, at.col, stamp.colors[r][c]) // a copy is whole
          } else if (drawing.colour && (art.chars[at.row]?.[at.col] ?? ' ') !== ' ') {
            setColor(art, at.row, at.col, stamp.colors[r][c])
          }
        })
      })
      repaintRect(row, col, row + stamp.chars.length - 1, col + width - 1)
      return
    }

    if (drawing.brush) setChar(art, row, col, glyph)
    // Colour on its own only touches glyphs that are already there; alongside the
    // brush it is a whole cell being stamped.
    if (drawing.colour && (drawing.brush || char !== ' ')) setColor(art, row, col, color)
    paintCell(cell, row, col)
  }

  const hitAt = (event) => {
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('.ae-cell')
    if (!cell) return null
    return { row: Number(cell.dataset.row), col: Number(cell.dataset.col), cell }
  }

  const selectDown = (hit) => {
    if (selection && inSelection(hit.row, hit.col)) {
      remember() // a carry is one step, like a stroke
      lift()
      grab = { row: hit.row, col: hit.col, from: { row: floating.row, col: floating.col } }
      return
    }
    floating = null
    grab = null
    anchor = { row: hit.row, col: hit.col }
    selection = { top: hit.row, bottom: hit.row, left: hit.col, right: hit.col }
    repaintRect(hit.row, hit.col, hit.row, hit.col)
    syncPalette()
  }

  const selectDrag = (hit) => {
    if (grab && floating) {
      const block = { rows: floating.chars.length, cols: bounds(floating).cols }
      const row = clamp(grab.from.row + (hit.row - grab.row), 0, grid.rows - block.rows)
      const col = clamp(grab.from.col + (hit.col - grab.col), 0, grid.cols - block.cols)
      if (row === floating.row && col === floating.col) return
      const was = selection
      floating.row = row
      floating.col = col
      selection = { top: row, bottom: row + block.rows - 1, left: col, right: col + block.cols - 1 }
      repaintRect(
        Math.min(was.top, selection.top),
        Math.min(was.left, selection.left),
        Math.max(was.bottom, selection.bottom),
        Math.max(was.right, selection.right),
      )
      syncPalette()
      return
    }
    if (!anchor) return
    const was = selection
    selection = {
      top: Math.min(anchor.row, hit.row),
      bottom: Math.max(anchor.row, hit.row),
      left: Math.min(anchor.col, hit.col),
      right: Math.max(anchor.col, hit.col),
    }
    repaintRect(
      Math.min(was.top, selection.top),
      Math.min(was.left, selection.left),
      Math.max(was.bottom, selection.bottom),
      Math.max(was.right, selection.right),
    )
    syncPalette()
  }

  const selectUp = () => {
    if (floating) {
      drop()
      repaintRect(selection.top, selection.left, selection.bottom, selection.right)
    } else if (anchor && selection.bottom === anchor.row && selection.right === anchor.col) {
      // A click that never moved means no selection, rather than a box of one.
      const was = selection
      selection = null
      repaintRect(was.top, was.left, was.bottom, was.right)
    }
    anchor = null
    grab = null
    syncPalette()
  }

  const stopPainting = () => {
    painting = false
    selectUp()
  }

  canvas.addEventListener('pointerdown', (event) => {
    const hit = hitAt(event)
    if (!hit) return
    if (tool === 'select') {
      selectDown(hit)
      return
    }
    if (tool === 'text') {
      // Placing the caret is not an edit, so it is not a step in the history.
      const was = cursor
      cursor = { row: hit.row, col: hit.col }
      refreshCursor(was)
      return
    }
    // A stroke is the unit of history. The eyedropper changes the brush, not the
    // art, so it has nothing to remember.
    if (tool === 'delete' || (tool === 'draw' && (drawing.brush || drawing.colour))) remember()
    painting = true
    applyAt(hit.cell)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (tool === 'text') return
    if (tool === 'select') {
      const hit = hitAt(event)
      if (hit) selectDrag(hit)
      return
    }
    if (!painting) return
    const hit = hitAt(event)
    if (hit) applyAt(hit.cell)
  })
  window.addEventListener('pointerup', stopPainting)

  // --- keys
  // Capture, on the document: the nav's global hotkeys listen for bare keys in
  // the bubble phase and would otherwise scroll the page behind the overlay.
  const onKey = (event) => {
    const key = event.key.toLowerCase()
    const claim = () => {
      event.preventDefault()
      event.stopPropagation()
    }

    // Undo and redo keep the modifiers that every other key turns away.
    if ((event.metaKey || event.ctrlKey) && key === 'z') {
      claim()
      if (event.shiftKey) redoOnce()
      else undoOnce()
      return
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return

    const target = event.target
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]')) {
      event.stopPropagation() // the field keeps the key; the page behind keeps still
      return
    }

    if (event.key === 'Escape') {
      claim()
      if (tool === 'text')
        setTool('draw') // one Escape puts the caret away, the next closes
      else close()
      return
    }

    // `tab` cycles the draw facets, which costs the overlay its focus traversal.
    if (key === 'tab') {
      claim()
      cycleDraw(event.shiftKey ? -1 : 1)
      return
    }

    if (typeAtCursor(event)) return

    if (!event.repeat && /^[0-9]$/.test(event.key)) {
      event.preventDefault()
      pickColor(Number(event.key))
    } else if (!event.repeat && key === 'b') {
      event.preventDefault()
      if (selection) startBrush()
      else toggleDraw('brush')
    } else if (!event.repeat && key === 'c') {
      event.preventDefault()
      toggleDraw('colour')
    } else if (!event.repeat && key === 't') {
      event.preventDefault()
      selectTool('text')
    } else if (!event.repeat && key === 'e') {
      event.preventDefault()
      selectTool('eyedropper')
    } else if (!event.repeat && key === 'd') {
      event.preventDefault()
      selectTool('delete')
    } else if (!event.repeat && key === 's') {
      event.preventDefault()
      selectTool('select')
    } else if (!event.repeat && key === 'x') {
      event.preventDefault()
      crop()
    }
    // Everything else stays out of the page behind. Enter and space are left
    // alone so a focused swatch still activates: stopping an event in the capture
    // phase keeps it from reaching the element the key was aimed at.
    if (event.key !== 'Enter' && event.key !== ' ') event.stopPropagation()
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

  drawGrid()
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
