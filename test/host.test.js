import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Updraft, apply, storePath } from '../src/host/index.js'

const REMOTE_METHODS = '@deepseek-ai/dsh-typert-protocol/remote-methods'

test('remote marker and parameter names', () => {
  const provided = {}
  apply({ reflect: { provide: (n, v) => { provided[n] = v } } })
  const s = provided.updraft
  assert.ok(s instanceof Updraft)
  assert.deepEqual(s.typertRemote.namespace, 'updraft')
  assert.deepEqual(Updraft.prototype[REMOTE_METHODS].methods.map(m => m.method), ['state', 'finish'])
  assert.match(Updraft.prototype.finish.toString(), /^async finish\(score\)/)
})

test('storePath honours DSH_HOME', () => {
  assert.equal(storePath({ DSH_HOME: '/x' }), '/x/storages/updraft.json')
})

test('finish keeps the best score and counts plays', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'updraft-'))
  const s = new Updraft(join(dir, 'storages', 'updraft.json'))
  assert.deepEqual(await s.state(), { best: 0, plays: 0 })
  await Promise.all([s.finish(5), s.finish(12), s.finish(3)])
  assert.deepEqual(await s.state(), { best: 12, plays: 3 })
  assert.equal((await s.finish(-1)).ok, false)
})
