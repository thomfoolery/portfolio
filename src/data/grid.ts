/**
 * The frame is 72 columns wide and every leader or rule fills it exactly, so
 * rows of dots and dashes line up down the page. One character cell, never a
 * measurement.
 */
export const LEADER = '.'.repeat(72)
export const RULE = '-'.repeat(72)

/**
 * The template compiler condenses runs of whitespace inside a text node, and
 * this layout is a character grid, so significant runs are interpolated here
 * where the compiler cannot reach them. A single leading or trailing space is
 * dropped outright for the same reason.
 */
export const GAP = '  '
export const SPACE = ' '
