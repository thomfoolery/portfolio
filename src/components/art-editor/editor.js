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
 * turns that area into the brush — a copy, centred on the pointer and projected
 * onto the grid in place, so where it will land is visible before it does. Any
 * character picked after that replaces it.
 *
 * `cmd+z` and `shift+cmd+z` walk a stack of whole-canvas snapshots, one per
 * stroke, twelve deep. Escape puts a tool down; asked again with unsaved changes
 * in hand it asks before closing, because the only way back from a discard is
 * the file on disk.
 *
 * It is loaded from Base.astro behind `import.meta.env.DEV`, so it never reaches
 * a build and nothing here ships.
 */
import { COLORS, WEIGHTS, bounds, parse, resize } from '@/lib/art'
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
/** Sizes a stroke can cover, centred on the pointer. */
const SIZES = [1, 2, 3, 5, 7]
/**
 * How much of the brush's box a stroke touches. The mask is keyed on canvas
 * coordinates, not the brush box, so dragging lays down one continuous pattern
 * instead of re-spacing at every pointer position. A hole skips the cell
 * entirely — it never writes a blank, so what is underneath survives.
 */
const DENSITIES = [
  { label: 'full', hit: () => true },
  { label: 'fine', hit: (row, col) => (row + col) % 2 === 0 },
  { label: 'coarse', hit: (row, col) => row % 2 === 0 && col % 2 === 0 },
  { label: 'extra coarse', hit: (row, col) => row % 3 === 0 && col % 3 === 0 },
]
/** `null` keeps the cell on the `<pre>`'s own weight, like `pre` does for colour. */
const WEIGHT_STEPS = [null, ...WEIGHTS]
/** How many strokes back `cmd+z` reaches. */
const UNDO_LIMIT = 12

const CHROME = `
  <header class="ae-bar">
    <span class="ae-title" data-path></span>
    <span class="ae-dims" data-dims></span>
    <span class="ae-status" data-status></span>
    <button class="ae-button" data-close type="button" aria-label="Close">×</button>
  </header>
  <div class="ae-confirm" data-confirm>
    <span>unsaved changes</span>
    <button class="ae-button" data-keep type="button">keep editing</button>
    <button class="ae-button" data-discard type="button">discard</button>
  </div>
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
      <h2>brush size</h2>
      <div class="ae-tools" data-sizes></div>
      <h2>density <span class="ae-hint">size &gt; 1</span></h2>
      <div class="ae-tools" data-densities></div>
      <h2>weight <span class="ae-hint">text</span></h2>
      <div class="ae-swatches" data-weights></div>
      <h2>canvas</h2>
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

/** Cells are created on demand, so a ragged row grows rather than gaining holes. */
function grow(art, row, col) {
  const chars = art.chars[row]
  const colors = art.colors[row]
  const weights = art.weights ? (art.weights[row] ?? (art.weights[row] = [])) : null
  while (chars.length <= col) {
    chars.push(' ')
    colors.push(null)
  }
  if (weights) while (weights.length <= col) weights.push(null)
}

/** The weights array only exists once a cell has a weight of its own. */
function ensureWeights(art) {
  if (!art.weights) art.weights = art.chars.map((row) => row.map(() => null))
  return art.weights
}

function setChar(art, row, col, char) {
  grow(art, row, col)
  art.chars[row][col] = char
}

function setColor(art, row, col, color) {
  grow(art, row, col)
  art.colors[row][col] = color
}

function setWeight(art, row, col, weight) {
  ensureWeights(art)
  grow(art, row, col)
  art.weights[row][col] = weight
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
  let size = SIZES[0]
  let density = DENSITIES[0]
  let weight = WEIGHT_STEPS[0]
  let painting = false
  /** Set by the first edit, and cleared only by a save. */
  let dirty = false
  /** True while the unsaved-changes question is on screen. */
  let asking = false
  /** A block lifted out of a selection, which becomes the brush until dropped. */
  let stamp = null
  /** Where the area brush would land, while the pointer is over the canvas. */
  let ghost = null
  /** The last cell the pointer was over, so a new brush can project at once. */
  let lastHit = null
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

  const inGhost = (row, col) =>
    ghost != null &&
    row >= ghost.row &&
    row < ghost.row + ghost.rows &&
    col >= ghost.col &&
    col < ghost.col + ghost.cols

  /** What a cell shows: whatever is floating over it, otherwise the art itself. */
  const cellState = (row, col) => {
    const from = (block) => {
      const r = row - block.row
      const c = col - block.col
      if (r < 0 || r >= block.rows || c < 0 || c >= block.cols) return null
      return {
        char: block.chars[r][c],
        color: block.colors[r][c],
        weight: block.weights?.[r]?.[c] ?? null,
      }
    }
    // The projection covers the art, and a carried block covers both.
    const state = (ghost && from(ghost)) || (floating && from(floating))
    if (state) return state
    return {
      char: art.chars[row]?.[col] ?? ' ',
      color: art.colors[row]?.[col] ?? null,
      weight: art.weights?.[row]?.[col] ?? null,
    }
  }

  const paintCell = (cell, row, col) => {
    const state = cellState(row, col)
    cell.textContent = state.char
    cell.style.color = colorVar(state.color)
    cell.style.fontWeight = state.weight ? String(state.weight) : ''
    cell.classList.toggle('ae-sel', inSelection(row, col))
    cell.classList.toggle('ae-ghost', inGhost(row, col))
    cell.classList.toggle(
      'ae-cur',
      tool === 'text' && cursor != null && cursor.row === row && cursor.col === col,
    )
  }

  /** The cells a stroke covers: `size` square, centred, clamped to the canvas. */
  const brushBox = (row, col, span) => {
    const half = Math.floor((span - 1) / 2)
    const top = clamp(row - half, 0, Math.max(0, grid.rows - 1))
    const left = clamp(col - half, 0, Math.max(0, grid.cols - 1))
    const cells = []
    for (let r = top; r <= Math.min(grid.rows - 1, top + span - 1); r += 1) {
      for (let c = left; c <= Math.min(grid.cols - 1, left + span - 1); c += 1) {
        cells.push({ row: r, col: c })
      }
    }
    return cells
  }

  const repaintBox = (cells) => {
    for (const at of cells) {
      paintCell(canvas.children[at.row * grid.cols + at.col], at.row, at.col)
    }
  }

  /** Repaint a rectangle of the grid. Only a move, a stamp or the cursor needs one. */
  const repaintRect = (top, left, bottom, right) => {
    for (let row = Math.max(0, top); row <= Math.min(grid.rows - 1, bottom); row += 1) {
      for (let col = Math.max(0, left); col <= Math.min(grid.cols - 1, right); col += 1) {
        paintCell(canvas.children[row * grid.cols + col], row, col)
      }
    }
  }

  /** Repaint the union of two boxes, so a projection can move without a full grid. */
  const repaintBlocks = (a, b) => {
    if (!a) {
      repaintRect(b.row, b.col, b.row + b.rows - 1, b.col + b.cols - 1)
      return
    }
    repaintRect(
      Math.min(a.row, b.row),
      Math.min(a.col, b.col),
      Math.max(a.row + a.rows - 1, b.row + b.rows - 1),
      Math.max(a.col + a.cols - 1, b.col + b.cols - 1),
    )
  }

  /**
   * Where a block lands when the cell under the pointer is its centre, clamped
   * into the canvas. Cropping at the edge instead of clamping would drop the
   * block's top rows and write its lower rows into row 0 — which is how the
   * first row of the art kept getting overwritten by a stamp aimed elsewhere.
   */
  const centred = (block, row, col) => ({
    row: clamp(row - Math.floor(block.rows / 2), 0, grid.rows - block.rows),
    col: clamp(col - Math.floor(block.cols / 2), 0, grid.cols - block.cols),
  })

  /** A block bigger than the canvas has nowhere to go. */
  const fits = (block) => block.rows <= grid.rows && block.cols <= grid.cols

  /** Project the area brush where it would land, so it can be placed by eye. */
  const previewAt = (hit) => {
    if (!stamp || tool !== 'draw' || !fits(stamp)) return
    const at = { ...stamp, ...centred(stamp, hit.row, hit.col) }
    if (ghost && ghost.row === at.row && ghost.col === at.col) return
    const was = ghost
    ghost = at // set before the repaint, so the new place draws its own projection
    repaintBlocks(was, at)
  }

  const hideGhost = () => {
    if (!ghost) return
    const was = ghost
    ghost = null
    repaintBlocks(null, was)
  }

  /** Changing the brush changes what a projection would show, so it goes. */
  const setStamp = (next) => {
    hideGhost()
    stamp = next
    syncPalette()
    if (next && lastHit) previewAt(lastHit)
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
  const snapshot = (source) => {
    const copy = {
      chars: source.chars.map((row) => [...row]),
      colors: source.colors.map((row) => [...row]),
    }
    if (source.weights) copy.weights = source.weights.map((row) => [...row])
    return copy
  }
  const undoStack = []
  const redoStack = []

  const remember = () => {
    undoStack.push(snapshot(art))
    if (undoStack.length > UNDO_LIMIT) undoStack.shift()
    redoStack.length = 0 // a fresh edit abandons the redo branch
    dirty = true
    hideConfirm() // an edit is an answer to the question
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
    const weights = []
    for (let row = top; row <= bottom; row += 1) {
      const lineChars = []
      const lineColors = []
      const lineWeights = []
      for (let col = left; col <= right; col += 1) {
        lineChars.push(art.chars[row]?.[col] ?? ' ')
        lineColors.push(art.colors[row]?.[col] ?? null)
        lineWeights.push(art.weights?.[row]?.[col] ?? null)
      }
      chars.push(lineChars)
      colors.push(lineColors)
      weights.push(lineWeights)
    }
    const block = { chars, colors, rows: chars.length, cols: chars[0].length }
    if (art.weights) block.weights = weights
    return block
  }

  /** Lift the selected cells out of the art, leaving blank the cells behind them. */
  const lift = () => {
    const block = readBlock(selection.top, selection.left, selection.bottom, selection.right)
    for (let row = selection.top; row <= selection.bottom; row += 1) {
      for (let col = selection.left; col <= selection.right; col += 1) {
        setChar(art, row, col, ' ')
        setColor(art, row, col, null)
        if (art.weights) setWeight(art, row, col, null)
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
        if (floating.weights)
          setWeight(art, floating.row + r, floating.col + c, floating.weights[r][c])
      })
    })
    floating = null
  }

  /** The area becomes the brush. A copy, so the art keeps what it had. */
  const startBrush = () => {
    if (!selection) return
    const block = readBlock(selection.top, selection.left, selection.bottom, selection.right)
    drawing.brush = true
    setTool('draw') // and that clears the box
    setStamp(block)
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
    if (weight != null) setWeight(art, cursor.row, cursor.col, weight)
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
    if (art.weights) setWeight(art, cursor.row, cursor.col, null)
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
    setStamp(null)
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
        setStamp(null) // picking a character is what makes the area brush temporary
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

  const sizeButtons = SIZES.map((value) =>
    swatch(
      `${value}x${value}`,
      `brush size: ${value} wide`,
      () => {
        size = value
        setTool('draw')
      },
      'var(--color-green-900)',
    ),
  )
  $('[data-sizes]').append(...sizeButtons)

  const densityButtons = DENSITIES.map((value) =>
    swatch(
      value.label,
      `density: ${value.label}`,
      () => {
        density = value
        setTool('draw')
      },
      'var(--color-green-900)',
    ),
  )
  $('[data-densities]').append(...densityButtons)

  const weightButtons = WEIGHT_STEPS.map((value) =>
    swatch(
      value == null ? 'pre' : String(value),
      value == null ? 'weight: the pre\u2019s own' : `weight: ${value}`,
      () => {
        weight = value
        syncPalette()
      },
      'var(--color-green-900)',
    ),
  )
  $('[data-weights]').append(...weightButtons)

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
    if (name !== 'draw') hideGhost() // the projection belongs to drawing
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
    stampButton.textContent = stamp ? `area ${stamp.cols}x${stamp.rows}` : 'area'
    stampButton.setAttribute('aria-pressed', String(stamp != null))
    glyphButtons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(stamp == null && GLYPHS[i] === glyph))
    })
    colorButtons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(STEPS[i] === color))
    })
    sizeButtons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(SIZES[i] === size))
    })
    densityButtons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(DENSITIES[i] === density))
    })
    weightButtons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(WEIGHT_STEPS[i] === weight))
    })
    // Density only means anything once the brush covers more than one cell.
    for (const button of densityButtons) button.disabled = size === 1
    for (const button of weightButtons) button.hidden = tool !== 'text'
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
        setStamp(null)
      }
      if (drawing.colour) color = art.colors[row]?.[col] ?? null
      tool = 'draw'
      painting = false
      syncPalette()
      return
    }

    if (tool === 'delete') {
      for (const at of brushBox(row, col, size)) {
        setChar(art, at.row, at.col, ' ')
        setColor(art, at.row, at.col, null)
        if (art.weights) setWeight(art, at.row, at.col, null)
      }
      repaintBox(brushBox(row, col, size))
      return
    }

    if (stamp) {
      // The block is the brush, centred on the cell under the pointer and kept
      // on the canvas, so the projection and the write agree about where it is.
      if (!fits(stamp)) return
      const at = centred(stamp, row, col)
      stamp.chars.forEach((line, r) => {
        line.forEach((blockChar, c) => {
          const cell = { row: at.row + r, col: at.col + c }
          if (cell.row < 0 || cell.col < 0) return
          if (cell.row >= grid.rows || cell.col >= grid.cols) return
          if (drawing.brush) {
            setChar(art, cell.row, cell.col, blockChar)
            setColor(art, cell.row, cell.col, stamp.colors[r][c]) // a copy is whole
          } else if (drawing.colour && (art.chars[cell.row]?.[cell.col] ?? ' ') !== ' ') {
            setColor(art, cell.row, cell.col, stamp.colors[r][c])
          }
        })
      })
      repaintRect(at.row, at.col, at.row + stamp.rows - 1, at.col + stamp.cols - 1)
      return
    }

    const box = brushBox(row, col, size)
    for (const at of box) {
      // A hole in the pattern is not a blank: it leaves the cell alone, so what
      // was there survives.
      if (size > 1 && !density.hit(at.row, at.col)) continue
      const under = art.chars[at.row]?.[at.col] ?? ' '
      if (drawing.brush) setChar(art, at.row, at.col, glyph)
      // Colour on its own only touches glyphs that are already there; alongside
      // the brush it is a whole cell being stamped.
      if (drawing.colour && (drawing.brush || under !== ' ')) setColor(art, at.row, at.col, color)
    }
    repaintBox(box)
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
      const row = clamp(grab.from.row + (hit.row - grab.row), 0, grid.rows - floating.rows)
      const col = clamp(grab.from.col + (hit.col - grab.col), 0, grid.cols - floating.cols)
      if (row === floating.row && col === floating.col) return
      const was = selection
      floating.row = row
      floating.col = col
      selection = {
        top: row,
        bottom: row + floating.rows - 1,
        left: col,
        right: col + floating.cols - 1,
      }
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

  /**
   * Dragging in text mode paints the chosen weight over glyphs that are already
   * there. A plain click only moves the caret: repositioning it should not
   * quietly restyle the cell it lands on.
   */
  let weightStroke = false
  const paintWeight = (hit) => {
    const char = art.chars[hit.row]?.[hit.col] ?? ' '
    if (char === ' ') return // nothing to weight
    if (!weightStroke) {
      remember()
      weightStroke = true
    }
    setWeight(art, hit.row, hit.col, weight)
    paintCell(hit.cell, hit.row, hit.col)
  }

  const stopPainting = () => {
    painting = false
    weightStroke = false
    selectUp()
  }

  canvas.addEventListener('pointerdown', (event) => {
    const hit = hitAt(event)
    if (!hit) return
    lastHit = hit
    if (tool === 'select') {
      selectDown(hit)
      return
    }
    if (tool === 'text') {
      // Placing the caret is not an edit, so it is not a step in the history.
      const was = cursor
      cursor = { row: hit.row, col: hit.col }
      refreshCursor(was)
      painting = true // a drag from here weights what it crosses
      return
    }
    if (tool === 'draw') previewAt(hit)
    // A stroke is the unit of history. The eyedropper changes the brush, not the
    // art, so it has nothing to remember.
    if (tool === 'delete' || (tool === 'draw' && (drawing.brush || drawing.colour))) remember()
    painting = true
    applyAt(hit.cell)
  })
  canvas.addEventListener('pointermove', (event) => {
    const hit = hitAt(event)
    if (!hit) return
    lastHit = hit
    if (tool === 'text') {
      if (painting) paintWeight(hit)
      return
    }
    if (tool === 'select') {
      selectDrag(hit)
      return
    }
    if (tool === 'draw') previewAt(hit)
    if (painting) applyAt(hit.cell)
  })
  canvas.addEventListener('pointerleave', () => {
    lastHit = null
    hideGhost()
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
      // One Escape puts the tool down — the box and the caret both hold
      // something — the next asks to leave, and a further one gets on with it.
      if (asking) hideConfirm()
      else if (tool === 'select' || tool === 'text') setTool('draw')
      else requestClose()
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
  /** Ask before throwing away work that has not been written back to the file. */
  const showConfirm = () => {
    asking = true
    $('[data-confirm]').setAttribute('data-open', '')
    $('[data-keep]').focus()
  }

  const hideConfirm = () => {
    if (!asking) return
    asking = false
    $('[data-confirm]').removeAttribute('data-open')
    overlay.focus()
  }

  /** Escape and the × both land here: only a clean editor leaves without a word. */
  const requestClose = () => {
    if (dirty) showConfirm()
    else close()
  }

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
        body: JSON.stringify({ path, chars: art.chars, colors: art.colors, weights: art.weights }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error ?? response.statusText)
      dirty = false // the file has it now
      close()
    } catch (error) {
      status.setAttribute('data-error', '')
      status.textContent = `save failed: ${error.message}`
    }
  }

  $('[data-close]').addEventListener('click', requestClose)
  $('[data-cancel]').addEventListener('click', close) // Cancel says what it does
  $('[data-save]').addEventListener('click', save)
  $('[data-keep]').addEventListener('click', hideConfirm)
  $('[data-discard]').addEventListener('click', close)

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
