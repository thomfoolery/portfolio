const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/**
 * Text read out of markup, with its character references turned back into the
 * characters: the named ones a serializer writes, and any numeric one. An entity
 * it does not know stays as written.
 *
 * Shared by `lib/art`, which reads a fragment the browser serialized, and
 * `lib/ascii-table`, which reads the cells Astro rendered.
 */
export const decode = (html: string) =>
  html.replace(/&(#x[\da-f]+|#\d+|[a-z\d]+);/gi, (entity: string, name: string) => {
    if (name[0] !== '#') return ENTITIES[name] ?? entity
    return String.fromCodePoint(
      name[1] === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1)),
    )
  })
