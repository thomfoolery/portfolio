import { RULE } from '@/data/grid'
import { decode } from '@/lib/html'

/**
 * Lays out a box-drawn table on the 72-column grid, for `ui/Table.astro`.
 *
 * Astro has no context, so a `Table` cannot ask its `Tr`s and `Td`s for their
 * props. Instead they render to marker elements, the table renders them to
 * HTML, and `parse` reads the markers back: their `data-` attributes and the
 * text inside them.
 *
 * The table's columns are a grid: as many as the widest row spans, spread
 * evenly over the 72. A cell spans `colSpan` of them, rows are separated by a
 * rule, and its junctions (┬ ┼ ┴) fall where the cells above and below divide.
 *
 * A cell holds text, so the table can draw it without passing HTML through. A
 * link is written as markdown, `[text](href "title")`, and drawn with `ui/Link`:
 * an `http(s)` href is external, and its ➚ takes a cell of its own.
 */
export type Run = { text: string; href?: string; title?: string; external?: boolean }
export type Cell = { span: number; heading: Run[][]; text: Run[][] }
export type Row = Cell[]
export type Segment =
  | { kind: 'border' | 'head' | 'text'; text: string }
  | { kind: 'link'; text: string; href: string; title?: string; external: boolean }

const WIDTH = RULE.length

/** Characters, not UTF-16 units: one per cell. */
const cells = (text: string) => [...text].length
const width = (runs: readonly Run[]) =>
  runs.reduce((sum, run) => sum + cells(run.text) + (run.external ? 1 : 0), 0)

const LINK = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g

/** A line of text, split where markdown links start and end. */
function runs(line: string): Run[] {
  const out: Run[] = []
  let at = 0
  for (const match of line.matchAll(LINK)) {
    const [whole, text = '', href = '', title] = match
    if (match.index > at) out.push({ text: line.slice(at, match.index) })
    out.push({ text, href, title, external: /^https?:\/\//.test(href) })
    at = match.index + whole.length
  }
  if (at < line.length) out.push({ text: line.slice(at) })
  return out
}

/**
 * A cell's text, as lines. Whitespace with a line break in it is source
 * formatting, as it is in HTML; a run of spaces on one line is kept, since only
 * an expression can put one there.
 */
function lines(html: string, where: string): Run[][] {
  const out = html.split(/<br\b[^>]*>/).map((line) => {
    if (line.includes('<')) {
      throw new Error(
        `${where}: a cell holds text: a link is [text](href), a line break <br />; found ${line.trim()}`,
      )
    }
    return runs(decode(line.replace(/\s*\n\s*/g, ' ').trim()))
  })
  return out.length === 1 && out[0]!.length === 0 ? [] : out
}

/** Rows of cells from a table's rendered `Tr`s and `Td`s. */
export function parse(html: string): Row[] {
  const rows: Row[] = []
  // Either marker may carry attributes it did not write: `astro dev` tags every
  // element with its source file.
  const rest = html.replace(/<ascii-tr\b[^>]*>([\s\S]*?)<\/ascii-tr>/g, (_, inner: string) => {
    const where = `Row ${rows.length + 1}`
    const row: Row = []
    const stray = inner.replace(
      /<ascii-td\b([^>]*)>([\s\S]*?)<\/ascii-td>/g,
      (_, attrs: string, body: string) => {
        const attr = (name: string) => attrs.match(new RegExp(`data-${name}="([^"]*)"`))?.[1]
        const heading = attr('heading')
        row.push({
          span: Number(attr('span') ?? 1),
          heading: heading ? [[{ text: decode(heading) }]] : [],
          text: lines(body, `${where}, cell ${row.length + 1}`),
        })
        return ''
      },
    )
    if (stray.trim()) throw new Error(`${where}: only a Td goes in a Tr; found ${stray.trim()}`)
    rows.push(row)
    return ''
  })
  if (rest.trim()) throw new Error(`Only a Tr goes in a Table; found ${rest.trim()}`)
  if (rows.length === 0) throw new Error('A Table needs a Tr')
  return rows
}

/**
 * Breaks a line at its spaces to fit `room`, keeping any run of spaces it does
 * not break at. A link is never broken.
 */
function wrap(line: Run[], room: number, where: string): Run[][] {
  if (width(line) <= room) return [line]
  const words: Run[][] = [[]]
  for (const run of line) {
    if (run.href) words.at(-1)!.push(run)
    else
      for (const part of run.text.split(/( +)/)) {
        if (part.startsWith(' ')) words.push([])
        else if (part) words.at(-1)!.push({ text: part })
      }
  }
  const out: Run[][] = []
  let current: Run[] = []
  for (const word of words.filter((word) => word.length)) {
    if (width(word) > room) {
      const text = word.map((run) => run.text).join('')
      throw new Error(`${where}: "${text}" is ${width(word)} wide, its column ${room}`)
    }
    if (current.length && width(current) + 1 + width(word) > room) {
      out.push(current)
      current = word
    } else current = current.length ? [...current, { text: ' ' }, ...word] : word
  }
  return [...out, current]
}

function rule(up: Set<number> | null, down: Set<number> | null): Segment {
  const edge = (top: string, middle: string, bottom: string) =>
    up ? (down ? middle : bottom) : top
  let text = ''
  for (let x = 0; x < WIDTH; x++) {
    const u = up?.has(x) ?? false
    const d = down?.has(x) ?? false
    if (x === 0) text += edge('┌', '├', '└')
    else if (x === WIDTH - 1) text += edge('┐', '┤', '┘')
    else text += u ? (d ? '┼' : '┴') : d ? '┬' : '─'
  }
  return { kind: 'border', text }
}

/** The table's lines, top rule to bottom, each a run of segments. */
export function layout(rows: readonly Row[]): Segment[][] {
  const spans = rows.map((row) => row.reduce((sum, cell) => sum + cell.span, 0))
  const columns = Math.max(...spans)
  spans.forEach((span, r) => {
    if (span !== columns)
      throw new Error(`Row ${r + 1} spans ${span} of the table's ${columns} columns`)
  })
  // Where each column of the grid starts; the last entry is the right edge.
  const grid = Array.from({ length: columns + 1 }, (_, k) =>
    Math.round(((WIDTH - 1) * k) / columns),
  )

  const out: Segment[][] = []
  let above: Set<number> | null = null
  rows.forEach((row, r) => {
    let column = 0
    const placed = row.map((cell, c) => {
      const from = grid[column]!
      const to = grid[(column += cell.span)]!
      const room = to - from - 3
      const where = `Row ${r + 1}, cell ${c + 1}`
      if (room < 1) throw new Error(`${where} is too narrow: the grid has ${columns} columns`)
      return {
        to,
        room,
        heading: cell.heading.flatMap((line) => wrap(line, room, where)),
        text: cell.text.flatMap((line) => wrap(line, room, where)),
      }
    })
    const stops = new Set([0, ...placed.map((cell) => cell.to)])
    const headings = Math.max(...placed.map((cell) => cell.heading.length))
    const height = headings + Math.max(...placed.map((cell) => cell.text.length))
    if (height === 0) throw new Error(`Row ${r + 1} is empty`)

    out.push([rule(above, stops)])
    for (let line = 0; line < height; line++) {
      const segments: Segment[] = [{ kind: 'border', text: '│ ' }]
      placed.forEach((cell, c) => {
        const head = line < headings
        const content = (head ? cell.heading[line] : cell.text[line - headings]) ?? []
        for (const { text, href, title, external = false } of content) {
          segments.push(
            href
              ? { kind: 'link', text, href, title, external }
              : { kind: head ? 'head' : 'text', text },
          )
        }
        const end = c === placed.length - 1 ? ' │' : ' │ '
        segments.push({ kind: 'border', text: ' '.repeat(cell.room - width(content)) + end })
      })
      out.push(segments)
    }
    above = stops
  })
  out.push([rule(above, null)])
  return out
}
