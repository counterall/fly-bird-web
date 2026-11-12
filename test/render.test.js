// Renderer checks against a recording stand-in for a 2D canvas context: every
// method is a no-op except the ones whose calls the tests look at.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MEDALS, W, createGame } from '../web/game.js?v=dev'
import { SETTINGS, SETTINGS_BUTTON, THEMES, THEME_NAMES, render, segmentAt, settingsAt } from '../web/render.js?v=dev'

function recordingContext() {
  const calls = { text: [], dash: [], arc: [], fills: new Set(), stops: [] }
  const stub = () => ({ addColorStop(_, col) { calls.stops.push(col) } })
  const c = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key]
      if (key === 'fillText') return (s, x, y) => calls.text.push({ s: String(s), x, y, color: target.fillStyle })
      if (key === 'arc') return (x, y, r) => calls.arc.push({ x, y, r })
      if (key === 'setLineDash') return d => calls.dash.push(d)
      if (key === 'measureText') return s => ({ width: String(s).length * 8 })
      if (key === 'getLineDash') return () => []
      return stub
    },
    set(target, key, v) {
      if (key === 'fillStyle' && typeof v === 'string') calls.fills.add(v.toLowerCase())
      target[key] = v
      return true
    },
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

/** Render one frame of a fresh game with the given ui overrides. */
function frame(ui = {}, phase = 'ready') {
  const g = createGame('normal')
  g.phase = phase
  const { c, calls } = recordingContext()
  render(c, g, { best: 0, paused: false, touch: false, muted: false, ...ui })
  return calls
}

const inside = (r, dx = 0) => ({ x: r.x + dx, y: r.y })

test('segmentAt finds the segment under a point, or -1', () => {
  const r = { x: 200, y: 100, w: 300, h: 40 }
  assert.equal(segmentAt(r, 3, { x: 60, y: 100 }), 0)
  assert.equal(segmentAt(r, 3, { x: 200, y: 110 }), 1)
  assert.equal(segmentAt(r, 3, { x: 340, y: 90 }), 2)
  assert.equal(segmentAt(r, 3, { x: 200, y: 130 }), -1)
  assert.equal(segmentAt(r, 3, { x: 30, y: 100 }), -1)
})

test('settings panel: sound and theme toggles, Done, and tapping outside', () => {
  const { sound, theme, done } = SETTINGS
  assert.deepEqual(settingsAt(inside(sound, -sound.w / 4)), { muted: false })
  assert.deepEqual(settingsAt(inside(sound, sound.w / 4)), { muted: true })
  assert.deepEqual(settingsAt(inside(theme, -theme.w / 4)), { theme: THEME_NAMES[0] })
  assert.deepEqual(settingsAt(inside(theme, theme.w / 4)), { theme: THEME_NAMES[1] })
  assert.deepEqual(settingsAt(inside(done)), { close: true })
  assert.deepEqual(settingsAt({ x: 5, y: 5 }), { close: true }) // outside the panel
  assert.equal(settingsAt({ x: SETTINGS.x, y: SETTINGS.y - SETTINGS.h / 2 + 8 }), null) // the panel itself
})

test('themes: purple (the original) first, then classic', () => {
  assert.deepEqual(THEME_NAMES, ['purple', 'classic'])
  for (const name of THEME_NAMES) assert.ok(THEMES[name].label)
})

test('the gear sits top right, where the speaker button was', () => {
  assert.ok(SETTINGS_BUTTON.x > 300 && SETTINGS_BUTTON.y < 60)
})

test('the settings panel shows sound and theme, with the current choices highlighted', () => {
  const ink = c => c.toLowerCase()
  for (const [muted, on] of [[false, 'On'], [true, 'Off']]) {
    for (const theme of THEME_NAMES) {
      const calls = frame({ settings: true, muted, theme })
      for (const s of ['Settings', 'Sound', 'Theme', 'Done', 'On', 'Off', ...THEME_NAMES.map(n => THEMES[n].label)]) {
        assert.ok(at(calls, s), `draws ${s}`)
      }
      const chosen = new Set(calls.text.filter(t => ink(t.color) === ink(at(calls, on).color)).map(t => t.s))
      assert.ok(chosen.has(on) && chosen.has(THEMES[theme].label), `${on} and ${theme} highlighted`)
      assert.ok(!chosen.has(on === 'On' ? 'Off' : 'On'))
    }
  }
  // closed: no panel
  assert.equal(at(frame({ settings: false }), 'Settings'), undefined)
  // open: the title screen underneath is hidden, not shown through
  assert.ok(at(frame({ settings: false }), 'UPDRAFT'))
  assert.equal(at(frame({ settings: true }), 'UPDRAFT'), undefined)
})

test('the panel replaces the Paused overlay while it is open', () => {
  assert.ok(at(frame({ paused: true }, 'playing'), 'Paused'))
  const calls = frame({ paused: true, settings: true }, 'playing')
  assert.equal(at(calls, 'Paused'), undefined)
  assert.ok(at(calls, 'Settings'))
})

test('the theme changes the sky and the bird', () => {
  const purple = frame({ theme: 'purple' })
  const classic = frame({ theme: 'classic' })
  assert.notDeepEqual(classic.stops, purple.stops)
  // classic: a blue day sky (blue the strongest channel at the top)
  const [r, , b] = classic.stops[0].match(/\d+/g).map(Number)
  assert.ok(b > r, `blue sky, got ${classic.stops[0]}`)
  assert.ok(classic.fills.has(THEMES.classic.bird.body.toLowerCase()))
  assert.ok(!purple.fills.has(THEMES.classic.bird.body.toLowerCase()))
  // no theme, or an unknown one, is purple
  assert.deepEqual(frame({}).stops, purple.stops)
  assert.deepEqual(frame({ theme: 'nope' }).stops, purple.stops)
})
