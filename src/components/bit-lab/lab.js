/**
 * The dev-only bit lab: a panel over the real page that tunes the stray bit
 * live, behind the real text, where it will be seen.
 *
 * Every setting in `data/bit.json` is a control. Moving one retunes the bit in
 * place and replays the current seed, so the change is seen on the same flight.
 * `fly` draws a new seed, `replay` flies this one again. `save` posts the whole
 * settings, seed included, to the dev server, which writes `data/bit.json` — the
 * file the page imports, so saving is shipping. It also copies them, and keeps
 * them in the rail below, where one click puts a saved set back.
 *
 * It is loaded from Base.astro behind `import.meta.env.DEV`, so it never reaches
 * a build and nothing here ships.
 */
import { bit } from '@/scripts/bit'
import { BOUNDS, GREENS, randomSeed } from '@/lib/bit'
import './lab.css'

const ENDPOINT = '/__bit-lab/save'
const RAIL = 'bit-lab:saved'
const OPEN = 'bit-lab:open'
const JUST_SAVED = 'bit-lab:just-saved'

/** In panel order. A range is a [min, max] pair; a green is a step of the scale. */
const CONTROLS = [
  { key: 'size', label: 'size px' },
  { key: 'lead', label: 'lead', green: true },
  { key: 'trail', label: 'trail', green: true },
  { key: 'followers', label: 'followers' },
  { key: 'lag', label: 'lag ms' },
  { key: 'fade', label: 'fade' },
  { key: 'speed', label: 'speed px/s', range: true },
  { key: 'gap', label: 'gap ms', range: true },
  { key: 'turns', label: 'turns', range: true },
  { key: 'stride', label: 'stride', range: true },
  { key: 'swerve', label: 'swerve' },
]

const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key)
      return value === null ? fallback : JSON.parse(value)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Private window or blocked storage: the rail just does not persist.
    }
  },
}

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}

if (bit) {
  let config = structuredClone(bit.config)
  let seed = config.seed

  const toggle = el('button', { type: 'button', className: 'bl-toggle', textContent: '[bit]' })
  const panel = el('section', { className: 'bl-panel', ariaLabel: 'Bit lab' })
  const seedInput = el('input', {
    type: 'number',
    min: BOUNDS.seed.min,
    max: BOUNDS.seed.max,
    step: 1,
    value: seed,
  })
  const status = el('p', { className: 'bl-status', role: 'status' })
  const rail = el('ol', { className: 'bl-rail' })

  const say = (text) => (status.textContent = text)

  const showSeed = (value) => {
    seed = value
    seedInput.value = String(value)
  }

  /** Retunes and replays: the see-tweak-see loop. Bad values stay in the panel. */
  let pending
  const apply = () => {
    clearTimeout(pending)
    pending = setTimeout(() => {
      try {
        bit.configure({ ...config, seed })
        bit.fly(seed)
        say('')
      } catch (error) {
        say(error.message)
      }
    }, 120)
  }

  /** One row per control, each wired to `config[key]`. Returns a refresher. */
  const rows = CONTROLS.map(({ key, label, green, range }) => {
    const row = el('div', { className: 'bl-row' })
    const name = el('span', { className: 'bl-name', textContent: label })

    if (green) {
      const select = el(
        'select',
        { ariaLabel: label },
        ...GREENS.map((step) => el('option', { value: String(step), textContent: String(step) })),
      )
      select.addEventListener('input', () => {
        config[key] = Number(select.value)
        apply()
      })
      row.append(el('label', {}, name, select))
      panel.append(row)
      return () => (select.value = String(config[key]))
    }

    const { min, max, step } = BOUNDS[key]
    const slider = (end, ariaLabel) => {
      const input = el('input', { type: 'range', min, max, step, ariaLabel })
      const out = el('output', { className: 'bl-out' })
      input.addEventListener('input', () => {
        const value = Number(input.value)
        if (end === undefined) config[key] = value
        else {
          // A range never runs backwards: dragging one end past the other pushes it.
          const pair = [...config[key]]
          pair[end] = value
          if (pair[0] > pair[1]) pair[1 - end] = value
          config[key] = pair
        }
        refresh()
        apply()
      })
      return { input, out }
    }

    const ends = range
      ? [slider(0, `${label} min`), slider(1, `${label} max`)]
      : [slider(undefined, label)]
    row.append(
      name,
      ...ends.map(({ input, out }) =>
        el('span', { className: range ? 'bl-end' : 'bl-end bl-wide' }, input, out),
      ),
    )
    panel.append(row)

    const refresh = () => {
      const values = range ? config[key] : [config[key]]
      ends.forEach(({ input, out }, i) => {
        input.value = String(values[i])
        out.textContent = String(values[i])
      })
    }
    return refresh
  })

  const refreshAll = () => {
    for (const refresh of rows) refresh()
    showSeed(seed)
  }

  const load = (next) => {
    config = structuredClone(next)
    showSeed(next.seed)
    refreshAll()
    apply()
  }

  const drawRail = () => {
    const saved = store.get(RAIL, [])
    rail.replaceChildren(
      ...saved.map((entry, i) =>
        el(
          'li',
          {},
          el('button', {
            type: 'button',
            textContent: `#${entry.seed}`,
            title: JSON.stringify(entry),
            onclick: () => load(entry),
          }),
          el('button', {
            type: 'button',
            className: 'bl-forget',
            ariaLabel: `forget #${entry.seed}`,
            textContent: 'x',
            onclick: () => {
              store.set(
                RAIL,
                saved.filter((_, j) => j !== i),
              )
              drawRail()
            },
          }),
        ),
      ),
    )
  }

  const save = async () => {
    const settings = { ...config, seed }
    const text = JSON.stringify(settings, null, 2)
    store.set(RAIL, [settings, ...store.get(RAIL, [])].slice(0, 24))
    drawRail()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard needs focus and permission; the file is the copy that matters.
    }
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: text,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? response.statusText)
      // Writing the file reloads the page, so the confirmation waits for the next load.
      sessionStorage.setItem(JUST_SAVED, result.path)
      say(`saved to ${result.path}`)
    } catch (error) {
      say(`not saved: ${error.message}`)
    }
  }

  seedInput.addEventListener('change', () => {
    const value = Number(seedInput.value)
    if (Number.isInteger(value) && value >= BOUNDS.seed.min && value <= BOUNDS.seed.max) {
      seed = value
      apply()
    } else showSeed(seed)
  })

  const button = (textContent, onclick) => el('button', { type: 'button', textContent, onclick })

  panel.prepend(
    el(
      'div',
      { className: 'bl-bar' },
      el('label', {}, el('span', { className: 'bl-name', textContent: 'seed' }), seedInput),
      button('fly', () => showSeed(bit.fly(randomSeed()))),
      button('replay', () => bit.fly(seed)),
      button('save', () => void save()),
    ),
  )
  panel.append(status, el('h2', { className: 'bl-name', textContent: 'saved' }), rail)

  // Trips the page launches on its own show their seed too, so one worth
  // keeping can be replayed.
  document.querySelector('[data-bit-layer]')?.addEventListener('bit:fly', (event) => {
    showSeed(event.detail)
  })

  const setOpen = (open) => {
    panel.hidden = !open
    toggle.setAttribute('aria-expanded', String(open))
    store.set(OPEN, open)
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden))

  document.body.append(toggle, panel)
  refreshAll()
  drawRail()
  setOpen(store.get(OPEN, true))

  try {
    const saved = sessionStorage.getItem(JUST_SAVED)
    if (saved) {
      say(`saved to ${saved}`)
      sessionStorage.removeItem(JUST_SAVED)
    }
  } catch {
    // Storage blocked: the save still happened, it just is not announced.
  }
}
