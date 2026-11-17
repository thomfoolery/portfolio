import { writeFile } from 'node:fs/promises'

/**
 * Refreshes `src/data/github.json`, the snapshot the GitHub table in
 * `Experience.astro` reads: run `pnpm github`, then commit the file. The build
 * reads the snapshot and never the network, so the numbers change only when this
 * runs.
 *
 * It reads GitHub's public API without a token, and keeps only what the table
 * shows, so a refresh with nothing new writes the same file.
 */
const USER = 'thomfoolery'
const TARGET = 'src/data/github.json'

async function get(path: string): Promise<unknown> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { accept: 'application/vnd.github+json' },
  })
  if (!response.ok) throw new Error(`GET ${path}: ${response.status} ${response.statusText}`)
  return response.json()
}

/** One field of an API object, or a failure if GitHub has changed its shape. */
function read<T>(value: unknown, key: string, is: (field: unknown) => field is T): T {
  const field = (value as Record<string, unknown> | null)?.[key]
  if (!is(field)) throw new Error(`GitHub sent no usable ${key}`)
  return field
}
const isString = (field: unknown): field is string => typeof field === 'string'
const isNumber = (field: unknown): field is number => typeof field === 'number'
const isBoolean = (field: unknown): field is boolean => typeof field === 'boolean'
const isLanguage = (field: unknown): field is string | null => field === null || isString(field)

const user = await get(`/users/${USER}`)
const repos: unknown[] = []
for (let page = 1; ; page++) {
  const batch = await get(`/users/${USER}/repos?per_page=100&page=${page}`)
  if (!Array.isArray(batch)) throw new Error('GitHub sent no list of repos')
  repos.push(...(batch as unknown[]))
  if (batch.length < 100) break
}

const own = repos
  .map((repo) => ({
    name: read(repo, 'name', isString),
    url: read(repo, 'html_url', isString),
    fork: read(repo, 'fork', isBoolean),
    language: read(repo, 'language', isLanguage),
    stars: read(repo, 'stargazers_count', isNumber),
  }))
  .filter((repo) => !repo.fork)

// Ties go alphabetically, so the order is the same from one refresh to the next.
const counts = new Map<string, number>()
for (const { language } of own) if (language) counts.set(language, (counts.get(language) ?? 0) + 1)
const languages = [...counts]
  .sort(([a, m], [b, n]) => n - m || a.localeCompare(b))
  .slice(0, 3)
  .map(([name]) => name)
const starred = own.toSorted((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))[0]
if (!starred) throw new Error(`${USER} has no repos of their own`)

const snapshot = {
  login: read(user, 'login', isString),
  url: read(user, 'html_url', isString),
  since: read(user, 'created_at', isString).slice(0, 10),
  repos: { own: own.length, all: repos.length },
  languages,
  starred: { name: starred.name, url: starred.url },
}
await writeFile(TARGET, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`Wrote ${TARGET}`)
