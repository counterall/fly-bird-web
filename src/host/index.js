// Host half of dsh-updraft (bundled into lib/index.js).
//
// An `updraft` Remote service the widget calls to load and save the best
// score, stored in $DSH_HOME/storages/updraft.json.
//
// No @deepseek-ai/* imports: the package is installed outside the app's module
// tree. The Remote binding below is the same metadata `TypertRemoteService` and
// `@Remote` produce; parameter names are read from the method source, so keep
// them plain identifiers and do not minify this bundle.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export const name = 'dsh-updraft'

const SERVICE = 'updraft'
const REMOTE_METHODS = '@deepseek-ai/dsh-typert-protocol/remote-methods'

export function storePath(env = process.env) {
  const home = env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return join(home, 'storages', 'updraft.json')
}

const cleanScore = v => (Number.isInteger(v) && v >= 0 && v < 1e6 ? v : 0)

export async function load(file) {
  try {
    const v = JSON.parse(await readFile(file, 'utf8'))
    return { best: cleanScore(v?.best), plays: cleanScore(v?.plays) }
  } catch {
    return { best: 0, plays: 0 }
  }
}

async function save(file, data) {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`)
  await rename(tmp, file)
}

export class Updraft {
  constructor(file) {
    this.file = file
    this.tail = Promise.resolve() // serialises writes
    this.typertRemote = Object.freeze({ service: this, serviceKey: SERVICE, namespace: SERVICE })
  }

  async state() {
    return load(this.file)
  }

  /** Record a finished run; keeps the higher best. Returns the stored state. */
  async finish(score) {
    if (!Number.isInteger(score) || score < 0) return { ok: false, error: 'score must be a non-negative integer' }
    const run = this.tail.then(async () => {
      const cur = await load(this.file)
      const next = { best: Math.max(cur.best, score), plays: cur.plays + 1 }
      await save(this.file, next)
      return next
    })
    this.tail = run.catch(() => {})
    return run
  }
}

Object.defineProperty(Updraft.prototype, REMOTE_METHODS, {
  configurable: true,
  value: Object.freeze({
    version: 1,
    methods: Object.freeze(['state', 'finish']
      .map(method => Object.freeze({ method, invocation: Object.freeze({ kind: 'direct' }) }))),
  }),
})

export function apply(ctx) {
  ctx.reflect.provide(SERVICE, new Updraft(storePath()))
}
