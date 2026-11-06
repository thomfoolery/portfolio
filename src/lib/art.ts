/**
 * The ASCII art as data: a grid of characters and a grid of colours.
 *
 * A cell's colour is one of the phosphor steps, or `null` when it inherits the
 * `<pre>`'s own colour — which is how most of the art is written.
 *
 * Rows are ragged on purpose. The fragments have rows of different lengths, and
 * padding them would add trailing spaces to every file the first time it was
 * saved. A row is only as long as it has cells.
 */
export const COLORS = [
  'green-100',
  'green-200',
  'green-300',
  'green-400',
  'green-500',
  'green-600',
  'green-700',
  'green-800',
  'green-900',
] as const

export type Color = (typeof COLORS)[number] | null

/**
 * The class each step compiles to. Spelled out rather than built from the colour
 * name: Tailwind reads the source for candidates, and `text-${color}` renders a
 * class that no scan can see, so the utilities would quietly vanish from the
 * sheet. See AGENTS.md.
 */
const COLOR_CLASS: Record<NonNullable<Color>, string> = {
  'green-100': 'text-green-100',
  'green-200': 'text-green-200',
  'green-300': 'text-green-300',
  'green-400': 'text-green-400',
  'green-500': 'text-green-500',
  'green-600': 'text-green-600',
  'green-700': 'text-green-700',
  'green-800': 'text-green-800',
  'green-900': 'text-green-900',
}

export type Art = {
  /** one array per row; `chars[r][c]` is a single character */
  chars: string[][]
  /** the same shape as `chars` */
  colors: Color[][]
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  nbsp: '\u00a0',
  '#39': "'",
}

const unescape = (text: string) =>
  text.replace(/&(#?[a-z0-9]+);/gi, (match, name: string) => ENTITIES[name] ?? match)

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Split a fragment into the `<pre>`'s attributes and the markup inside it. */
export function splitPre(fragment: string): { attrs: string; inner: string } {
  const match = /<pre\b([^>]*)>([\s\S]*)<\/pre>/.exec(fragment)
  if (!match) throw new Error('art fragment is not a single <pre>')
  const [, attrs = '', inner = ''] = match
  return { attrs: attrs.trim(), inner }
}

export function parse(fragment: string): Art {
  const { inner } = splitPre(fragment)
  const chars: string[][] = [[]]
  const colors: Color[][] = [[]]
  const stack: Color[] = []
  let color: Color = null

  const token = /<span\b([^>]*)>|<\/span>|<[^>]+>|([^<]+)/g
  let match: RegExpExecArray | null
  while ((match = token.exec(inner))) {
    const text = match[2]
    if (text != null) {
      for (const char of unescape(text)) {
        if (char === '\n') {
          chars.push([])
          colors.push([])
          continue
        }
        chars[chars.length - 1]!.push(char)
        colors[colors.length - 1]!.push(color)
      }
      continue
    }
    if (match[0] === '</span>') {
      color = stack.pop() ?? null
      continue
    }
    if (match[1] != null) {
      stack.push(color)
      const found = /class="[^"]*\btext-(green-\d00)\b/.exec(match[1])
      color = (found?.[1] as Color) ?? color
    }
  }

  return { chars, colors }
}

/** The markup inside the `<pre>`, with a span per run of one colour. */
export function render(art: Art): string {
  return art.chars
    .map((row, r) => {
      let out = ''
      let c = 0
      while (c < row.length) {
        const color = art.colors[r]?.[c] ?? null
        let end = c
        while (end < row.length && (art.colors[r]?.[end] ?? null) === color) end += 1
        const text = escape(row.slice(c, end).join(''))
        out += color ? `<span class="${COLOR_CLASS[color]}">${text}</span>` : text
        c = end
      }
      return out
    })
    .join('\n')
}

/** A whole fragment, keeping the `<pre>`'s attributes. */
export function renderFragment(attrs: string, art: Art): string {
  return `<pre${attrs ? ' ' + attrs : ''}>${render(art)}</pre>\n`
}

/** Crop or pad to a rectangle. New cells are blank and inherit their colour. */
export function resize(art: Art, cols: number, rows: number): Art {
  const chars: string[][] = []
  const colors: Color[][] = []
  for (let r = 0; r < rows; r += 1) {
    const row = art.chars[r] ?? []
    const rowColors = art.colors[r] ?? []
    const nextChars: string[] = []
    const nextColors: Color[] = []
    for (let c = 0; c < cols; c += 1) {
      const char = row[c]
      nextChars.push(char ?? ' ')
      nextColors.push(char == null ? null : (rowColors[c] ?? null))
    }
    chars.push(nextChars)
    colors.push(nextColors)
  }
  return { chars, colors }
}

/** The rectangle the art occupies: the widest row, and the row count. */
export function bounds(art: Art): { cols: number; rows: number } {
  return {
    cols: art.chars.reduce((widest, row) => Math.max(widest, row.length), 0),
    rows: art.chars.length,
  }
}

/**
 * The JSON an art block is stored as. One row per line: the arrays are long, and
 * one cell per line would be several thousand lines of punctuation.
 */
export function serialize(art: Art): string {
  const cells = (row: readonly unknown[]) =>
    `[${row.map((cell) => JSON.stringify(cell)).join(',')}]`
  const grid = (rows: readonly (readonly unknown[])[]) =>
    rows.map((row) => `    ${cells(row)}`).join(',\n')
  return `{\n  "chars": [\n${grid(art.chars)}\n  ],\n  "colors": [\n${grid(art.colors)}\n  ]\n}\n`
}
