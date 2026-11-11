// Entry point: sizes the canvas to the window, runs the game loop and input.
import { GROUND, H, W, createGame, flap, medalFor, step } from './game.js'
import { MUTE_BUTTON, render } from './render.js'
import { createSound } from './sound.js'

const LS_BEST = 'updraft:best'
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
let g = createGame()
let best = Number.parseInt(load(LS_BEST) ?? '0', 10) || 0
const sound = createSound(load(LS_MUTED) === '1')
let paused = false
let touch = matchMedia('(pointer: coarse)').matches
let last = performance.now()

function saveBest(score) {
  if (score <= best) return
  best = score
  store(LS_BEST, best)
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
  if (g.mode === 'playing' && g.flapAt === g.t) sound.play('flap')
}

function togglePause() {
  if (g.mode !== 'playing') return
  paused = !paused
  last = performance.now()
}

// Losing focus mid-run shouldn't cost the player their run.
function autoPause() {
  if (g.mode === 'playing') paused = true
}

function frame(now) {
  const dt = (now - last) / 1000
  last = now
  g.ceil = -view.top
  g.floor = view.ground
  if (!paused) {
    const was = g.mode
    const score = g.score
    step(g, dt)
    if (g.score > score) sound.play(medalFor(g.score)?.score === g.score ? 'medal' : 'score')
    if (was === 'playing' && g.mode === 'over') {
      sound.play('crash')
      saveBest(g.score)
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
  render(c, g, { best, paused, touch, muted: sound.muted }, view)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

/** Is the page point (clientX, clientY) on the mute button? */
function onMuteButton(clientX, clientY) {
  const r = canvas.getBoundingClientRect()
  const x = ((clientX - r.left) / r.width) * W
  const y = ((clientY - r.top) / r.height) * (H + view.top + view.bottom) - view.top
  return Math.hypot(x - MUTE_BUTTON.x, y - MUTE_BUTTON.y) <= MUTE_BUTTON.r
}

addEventListener('keydown', e => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
  sound.unlock()
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); touch = false; press() }
  else if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause() }
  else if (e.code === 'KeyM') { e.preventDefault(); toggleMute() }
})
// Anywhere on the page counts as a flap, so phones don't need to aim at the
// canvas; only the mute button is excluded.
addEventListener('pointerdown', e => {
  if (e.button > 0) return
  e.preventDefault()
  touch = e.pointerType === 'touch'
  sound.unlock()
  if (onMuteButton(e.clientX, e.clientY)) toggleMute()
  else press()
}, { passive: false })
// Mobile browsers only let audio start on pointerup / touchend, not pointerdown.
addEventListener('pointerup', () => sound.unlock())
addEventListener('blur', autoPause)
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause() })
