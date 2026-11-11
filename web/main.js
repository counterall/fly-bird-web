// Entry point: sizes the canvas to the window, runs the game loop and input.
import { H, W, createGame, flap, step } from './game.js'
import { render } from './render.js'

const LS_BEST = 'updraft:best'

function readBest() {
  try { return Number.parseInt(localStorage.getItem(LS_BEST) ?? '0', 10) || 0 } catch { return 0 }
}
function writeBest(v) {
  try { localStorage.setItem(LS_BEST, String(v)) } catch {}
}

const canvas = document.getElementById('game')
const c = canvas.getContext('2d')
let g = createGame()
let best = readBest()
let paused = false
let touch = matchMedia('(pointer: coarse)').matches
let last = performance.now()

// Fit the 2:3 playfield inside the window.
function fit() {
  const margin = innerWidth < 500 ? 0 : 24
  const scale = Math.min((innerWidth - margin * 2) / W, (innerHeight - margin * 2) / H)
  canvas.style.width = `${Math.floor(W * scale)}px`
  canvas.style.height = `${Math.floor(H * scale)}px`
}
addEventListener('resize', fit)
fit()

function press() {
  if (paused) { paused = false; last = performance.now(); return }
  g = flap(g)
}

function togglePause() {
  if (g.mode !== 'playing') return
  paused = !paused
  last = performance.now()
}

function frame(now) {
  const dt = (now - last) / 1000
  last = now
  if (!paused) {
    const was = g.mode
    step(g, dt)
    if (was === 'playing' && g.mode === 'over' && g.score > best) {
      best = g.score
      writeBest(best)
    }
  }
  const dpr = devicePixelRatio || 1
  const pw = Math.round(canvas.clientWidth * dpr)
  const ph = Math.round(canvas.clientHeight * dpr)
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph }
  c.setTransform(pw / W, 0, 0, ph / H, 0, 0)
  render(c, g, best, paused, touch)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

addEventListener('keydown', e => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); touch = false; press() }
  else if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause() }
})
// Anywhere on the page counts as a flap, so phones don't need to aim at the canvas.
addEventListener('pointerdown', e => {
  if (e.button > 0) return
  e.preventDefault()
  touch = e.pointerType === 'touch'
  press()
}, { passive: false })
addEventListener('blur', () => { if (g.mode === 'playing') paused = true })
document.addEventListener('visibilitychange', () => { if (document.hidden && g.mode === 'playing') paused = true })
