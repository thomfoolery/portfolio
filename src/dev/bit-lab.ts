import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AstroIntegration } from 'astro'

import { parseBitConfig } from '../lib/bit'
import type { BitConfig } from '../lib/bit'

/**
 * The dev server's other half of the bit lab: `POST` a full set of settings and
 * it writes `src/data/bit.json`, the file the page imports. It exists only
 * under `astro dev` — the hook never runs for a build — so the deployed site has
 * no write path, and no endpoint at all.
 *
 * It writes one file and nothing else, and only settings `parseBitConfig`
 * accepts, so a slider cannot save a bit that would not fly.
 */
const ENDPOINT = '/__bit-lab/save'
const TARGET = 'src/data/bit.json'

/** Keys in a fixed order, ranges kept on one line: the file Prettier would write. */
function serialize(config: BitConfig) {
  const order: (keyof BitConfig)[] = [
    'seed',
    'size',
    'lead',
    'trail',
    'followers',
    'lag',
    'fade',
    'speed',
    'gap',
    'turns',
    'stride',
    'swerve',
  ]
  const lines = order.map((key) => {
    const value = config[key]
    return `  "${key}": ${Array.isArray(value) ? `[${value.join(', ')}]` : JSON.stringify(value)}`
  })
  return `{\n${lines.join(',\n')}\n}\n`
}

export function bitLab(): AstroIntegration {
  return {
    name: 'bit-lab',
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

            let config: BitConfig
            try {
              config = parseBitConfig(JSON.parse(Buffer.concat(chunks).toString('utf8')))
            } catch (error) {
              fail(400, error instanceof Error ? error.message : 'body is not bit settings')
              return
            }

            writeFile(path.join(process.cwd(), TARGET), serialize(config), 'utf8').then(
              () => {
                response.setHeader('content-type', 'application/json')
                response.end(JSON.stringify({ ok: true, path: TARGET }))
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
