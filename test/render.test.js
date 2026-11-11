// Renderer checks against a recording stand-in for a 2D canvas context: every
// method is a no-op except the ones whose calls the tests look at.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MEDALS, W, createGame } from '../web/game.js?v=dev'
import { render } from '../web/render.js?v=dev'

function recordingContext() {
  const calls = { text: [], dash: [], arc: [] }
  const stub = () => ({ addColorStop() {} })
  const c = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key]
      if (key === 'fillText') return (s, x, y) => calls.text.push({ s: String(s), x, y })
      if (key === 'arc') return (x, y, r) => calls.arc.push({ x, y, r })
      if (key === 'setLineDash') return d => calls.dash.push(d)
      if (key === 'measureText') return s => ({ width: String(s).length * 8 })
      if (key === 'getLineDash') return () => []
      return stub
    },
    set(target, key, v) { target[key] = v; return true },
  })
  return { c, calls }
}

/** Render the Grounded card after a run that scored `score`. */
function grounded(score, best = score) {
  const g = createGame('normal')
  g.phase = 'over'
  g.score = score
  g.overAt = 0
  g.t = 1
  const { c, calls } = recordingContext()
  render(c, g, { best, paused: false, touch: false, muted: false })
  return calls
}

const at = (calls, s) => calls.text.find(t => t.s === s)

test('Grounded card without a medal has no empty medal slot', () => {
  const calls = grounded(MEDALS[0].score - 1)
  assert.ok(at(calls, 'Grounded'))
  assert.equal(at(calls, 'No medal'), undefined)
  assert.deepEqual(calls.dash.filter(d => d.length), [], 'no dashed empty-slot ring')
  // score and best sit centred on the card instead of right of a medal
  const score = at(calls, 'Score')
  const best = calls.text.find(t => t.s.endsWith(' best'))
  assert.equal((score.x + best.x) / 2, W / 2)
})

test('Grounded card with a medal still shows it', () => {
  const calls = grounded(MEDALS[0].score)
  assert.ok(at(calls, 'Bronze'))
  const name = at(calls, 'Bronze')
  assert.ok(calls.arc.some(a => a.x === name.x && a.r >= 20), 'a medal disc above its name')
  const score = at(calls, 'Score')
  assert.ok(score.x > W / 2, 'score column moves right to make room for the medal')
})
