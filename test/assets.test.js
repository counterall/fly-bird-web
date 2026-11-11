// Every module the page loads carries ?v=dev, which the Pages workflow stamps
// with the commit ID at deploy time. A missing stamp would load that module
// under its bare URL, which browsers may serve stale from cache after a deploy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const web = new URL('../web/', import.meta.url)
const read = f => readFileSync(new URL(f, web), 'utf8')

test('every local module import and the entry script carry ?v=dev', () => {
  const refs = []
  for (const f of readdirSync(web).filter(f => f.endsWith('.js'))) {
    for (const [, spec] of read(f).matchAll(/^\s*import\b[^'"]*['"]([^'"]+)['"]/gm)) refs.push([f, spec])
  }
  for (const [, src] of read('index.html').matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) refs.push(['index.html', src])
  assert.ok(refs.length >= 6, `found only ${refs.length} references`)
  for (const [file, spec] of refs) {
    if (!spec.startsWith('.')) continue
    assert.match(spec, /\.js\?v=dev$/, `${file}: '${spec}' needs ?v=dev`)
  }
})
