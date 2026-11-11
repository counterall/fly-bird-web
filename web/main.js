// Entry point: sizes the canvas to the window, runs the game loop and input.
import { GROUND, H, LEVELS, W, createGame, flap, medalFor, step } from './game.js'
import { LEVEL_TOGGLE, MUTE_BUTTON, render } from './render.js'
import { createSound } from './sound.js'

const LS_BEST = level => `updraft:best:${level}`
const LS_BEST_OLD = 'updraft:best' // before levels: today's easy game
const LS_LEVEL = 'updraft:level'
const LS_MUTED = 'updraft:muted'

// localStorage can be unavailable (private mode, blocked site data).
function load(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function store(key, v) {
  try { localStorage.setItem(key, String(v)) } catch {}
}

const canvas = document.getElementById('game')
const c = canvas.getContext('2d')

// One-off migration: the best score from before levels counts as easy.
if (load(LS_BEST('easy')) === null && load(LS_BEST_OLD) !== null) store(LS_BEST('easy'), load(LS_BEST_OLD))

const bests = Object.fromEntries(LEVELS.map(l => [l, Number.parseInt(load(LS_BEST(l)) ?? '0', 10) || 0]))
let g = createGame(LEVELS.includes(load(LS_LEVEL)) ? load(LS_LEVEL) : 'easy')
const sound = createSound(load(LS_MUTED) === '1')
let paused = false
let touch = matchMedia('(pointer: coarse)').matches
let last = performance.now()

function saveBest(level, score) {
  if (score <= bests[level]) return
  bests[level] = score
  store(LS_BEST(level), score)
}

/** Pick the level on the title screen; it's remembered for next time. */
function chooseLevel(level) {
  if (g.phase !== 'ready' || g.level === level) return
  g.level = level
  store(LS_LEVEL, level)
}

function toggleMute() {
  store(LS_MUTED, sound.toggle() ? '1' : '0')
}

// Extra logical sky above / ground below the 400×600 playfield, for screens
// taller than 2:3. Gameplay happens in the same playfield on every device.
const view = { top: 0, bottom: 0, ground: GROUND }
const SKY_SHARE = 0.7 // share of the extra height given to the sky

// Portrait / tall windows (phones): fill the whole window edge to edge.
// Wider windows: a framed 2:3 card centred on the page.
function fit() {
  const vw = document.documentElement.clientWidth
  const vh = document.body.clientHeight // 100vh: full screen height, under mobile toolbars too
  const fill = vh / vw >= H / W
  document.body.classList.toggle('fill', fill)
  if (fill) {
    const extra = vh * (W / vw) - H
    view.top = Math.round(extra * SKY_SHARE)
    view.bottom = extra - view.top
    // Ground band: half of what the extra space would give it, the rest goes to
    // longer pillars. Measured against what is visible above mobile browser
    // toolbars (the canvas runs underneath them) so the ground stays in view.
    const hidden = Math.max(0, vh - (visualViewport?.height ?? vh)) * (W / vw)
    const visibleBottom = H + view.bottom - hidden
    view.ground = Math.max(GROUND, visibleBottom - (visibleBottom - GROUND) / 2)
    canvas.style.width = `${vw}px`
    canvas.style.height = `${vh}px`
  } else {
    view.top = view.bottom = 0
    view.ground = GROUND
    const margin = 24
    const scale = Math.min((vw - margin * 2) / W, (vh - margin * 2) / H)
    canvas.style.width = `${Math.floor(W * scale)}px`
    canvas.style.height = `${Math.floor(H * scale)}px`
  }
}
addEventListener('resize', fit)
visualViewport?.addEventListener('resize', fit)
fit()

function press() {
  if (paused) { paused = false; last = performance.now(); return }
  g = flap(g)
  if (g.phase === 'playing' && g.flapAt === g.t) sound.play('flap')
}

function togglePause() {
  if (g.phase !== 'playing') return
  paused = !paused
  last = performance.now()
}

// Losing focus mid-run shouldn't cost the player their run.
function autoPause() {
  if (g.phase === 'playing') paused = true
}

function frame(now) {
  const dt = (now - last) / 1000
  last = now
  g.ceil = -view.top
  g.floor = view.ground
  if (!paused) {
    const was = g.phase
    const score = g.score
    const lives = g.lives
    step(g, dt)
    if (g.score > score) sound.play(medalFor(g.score)?.score === g.score ? 'medal' : 'score')
    if (g.lives > lives) sound.play('trinket')
    if (g.lives < lives && g.phase === 'playing') sound.play('hurt')
    if (was === 'playing' && g.phase === 'over') {
      sound.play('crash')
      saveBest(g.level, g.score)
    }
  }
  // Match the backing store to the canvas's device pixels, then map the
  // logical field (plus any extra sky / ground) onto it.
  const dpr = devicePixelRatio || 1
  const pw = Math.round(canvas.clientWidth * dpr)
  const ph = Math.round(canvas.clientHeight * dpr)
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph }
  const sx = pw / W
  const sy = ph / (H + view.top + view.bottom)
  c.setTransform(sx, 0, 0, sy, 0, view.top * sy)
  render(c, g, { best: bests[g.level], paused, touch, muted: sound.muted }, view)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

/** A page point (clientX, clientY) in logical playfield units. */
function toLogical(clientX, clientY) {
  const r = canvas.getBoundingClientRect()
  return {
    x: ((clientX - r.left) / r.width) * W,
    y: ((clientY - r.top) / r.height) * (H + view.top + view.bottom) - view.top,
  }
}

/** The level whose half of the title-screen toggle is at p, if any. */
function levelAt({ x, y }) {
  const t = LEVEL_TOGGLE
  if (g.phase !== 'ready' || Math.abs(x - t.x) > t.w / 2 || Math.abs(y - t.y) > t.h / 2) return null
  return x < t.x ? 'easy' : 'hard'
}

addEventListener('keydown', e => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
  sound.unlock()
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); touch = false; press() }
  else if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause() }
  else if (e.code === 'KeyM') { e.preventDefault(); toggleMute() }
  else if (e.code === 'ArrowLeft' || e.code === 'Digit1') { e.preventDefault(); chooseLevel('easy') }
  else if (e.code === 'ArrowRight' || e.code === 'Digit2') { e.preventDefault(); chooseLevel('hard') }
})
// Anywhere on the page counts as a flap, so phones don't need to aim at the
// canvas; only the mute button and the level toggle are excluded.
addEventListener('pointerdown', e => {
  if (e.button > 0) return
  e.preventDefault()
  touch = e.pointerType === 'touch'
  sound.unlock()
  const p = toLogical(e.clientX, e.clientY)
  const level = levelAt(p)
  if (Math.hypot(p.x - MUTE_BUTTON.x, p.y - MUTE_BUTTON.y) <= MUTE_BUTTON.r) toggleMute()
  else if (level) chooseLevel(level)
  else press()
}, { passive: false })
// Mobile browsers only let audio start on pointerup / touchend, not pointerdown.
addEventListener('pointerup', () => sound.unlock())
addEventListener('blur', autoPause)
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause() })
