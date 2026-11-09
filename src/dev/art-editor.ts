import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AstroIntegration } from 'astro'

import { COLORS, WEIGHTS, serialize } from '../lib/art'
import type { Art } from '../lib/art'

/**
 * The dev server's other half of the art editor: `POST` two arrays and it writes
 * the block's JSON. It exists only under `astro dev` — the hook never runs for a
 * build — so the deployed site has no write path, and no endpoint at all.
 *
 * The path is validated against the art directory rather than trusted, so the
 * editor cannot be pointed at another file.
 */
const ENDPOINT = '/__art-editor/save'
const TARGET = /^src\/data\/art\/[a-z][a-z-]*\.json$/

const isGrid = (value: unknown, cell: (value: unknown) => boolean): value is unknown[][] =>
  Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every(cell))

const isChar = (value: unknown) => typeof value === 'string' && [...value].length === 1

const isColor = (value: unknown) =>
  value === null || (COLORS as readonly string[]).includes(value as string)

/** Weights are optional, but when present they have to be steps the face has. */
const isWeight = (value: unknown) =>
  value === null || (WEIGHTS as readonly number[]).includes(value as number)

export function artEditor(): AstroIntegration {
  return {
    name: 'art-editor',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(ENDPOINT, (request, response, next) => {
          if (request.method !== 'POST') {
            next()
            return
          }

          const chunks: Buffer[] = []
          request.on('data', (chunk: Buffer) => chunks.push(chunk))
          request.on('end', () => {
            const fail = (status: number, error: string) => {
              response.statusCode = status
              response.setHeader('content-type', 'application/json')
              response.end(JSON.stringify({ error }))
            }

            let body: unknown
            try {
              body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            } catch {
              fail(400, 'body is not JSON')
              return
            }
            if (typeof body !== 'object' || body === null) {
              fail(400, 'body is not an object')
              return
            }

            const { path: blockPath, chars, colors, weights } = body as Record<string, unknown>
            if (typeof blockPath !== 'string' || !TARGET.test(blockPath)) {
              fail(400, `not an art block: ${String(blockPath)}`)
              return
            }
            if (!isGrid(chars, isChar) || !isGrid(colors, isColor)) {
              fail(400, 'expected { chars: string[][], colors: (string | null)[][] }')
              return
            }
            if (
              chars.length !== colors.length ||
              chars.some((row, i) => row.length !== colors[i]?.length)
            ) {
              fail(400, 'chars and colors must be the same shape')
              return
            }
            if (weights != null) {
              if (!isGrid(weights, isWeight)) {
                fail(400, 'expected weights to be (number | null)[][]')
                return
              }
              if (
                weights.length !== chars.length ||
                weights.some((row, i) => row.length !== chars[i]?.length)
              ) {
                fail(400, 'weights must be the same shape as chars')
                return
              }
            }

            const file = path.join(process.cwd(), blockPath)
            if (!existsSync(file)) {
              fail(404, `no such art block: ${blockPath}`)
              return
            }

            const art: Art = {
              chars: chars as string[][],
              colors: colors as Art['colors'],
              ...(weights != null ? { weights: weights as Art['weights'] } : {}),
            }
            writeFile(file, serialize(art), 'utf8').then(
              () => {
                server.ws.send({ type: 'full-reload' })
                response.setHeader('content-type', 'application/json')
                response.end(JSON.stringify({ ok: true, path: blockPath }))
              },
              (error: unknown) =>
                fail(500, error instanceof Error ? error.message : 'write failed'),
            )
          })
        })
      },
    },
  }
}
