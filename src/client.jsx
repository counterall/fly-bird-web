// Browser half of dsh-updraft: sidebar entry + the game panel.
import { useEffect, useRef, useState } from 'react'
import { CFG, GROUND, H, W, createGame, flap, step } from './game.js'
import { bindConnection, call } from './remote.js'

const PANEL_ID = 'updraft'
const STYLE_ID = 'dsh-updraft-style'
const LS_BEST = 'dsh-updraft:best'

const CSS = `
.dshup-root { height: 100%; overflow: auto; display: flex; flex-direction: column; box-sizing: border-box;
  padding: 12px 20px 20px; background: var(--dsw-alias-bg-base, #fff); color: var(--dsw-alias-label-primary, #1b1b1f); }
body[data-ds-dark-theme] .dshup-root { color-scheme: dark; }
.dshup-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;
  padding-left: var(--dsh-frame-leading-clearance, 0px); margin-bottom: 12px; }
.dshup-head h1 { font-size: 18px; font-weight: 650; margin: 0; }
.dshup-head span { font-size: 13px; color: var(--dsw-alias-label-tertiary, #888); }
.dshup-stage { flex: 1; min-height: 320px; display: flex; align-items: center; justify-content: center; }
.dshup-canvas { display: block; border-radius: 14px; cursor: pointer; touch-action: manipulation; outline: none;
  box-shadow: 0 0 0 1px var(--dsw-alias-border-l1, rgba(0,0,0,.08)), 0 10px 30px rgba(20, 16, 50, .18); }
`

// ── palette ────────────────────────────────────────────────────────────────
const SKY = ['#2b2560', '#5b3f86', '#c4627a', '#f4a76a']
const HILL_FAR = '#6a4a86'
const HILL_NEAR = '#3d3268'
// Pillars: dusk-lit plum stone, rim-lit on the sun side (right) in peach.
const STONE = '#523b7c'
const STONE_SHADE = '#3c2b5f'
const STONE_RIM = '#f4a77a'
const STONE_COURSE = 'rgba(255, 200, 170, 0.10)'
const STONE_CAP = '#664a92'
const CAP_GLOW = '#ffc993'
const GROUND_TOP = '#2c5a5a'
const GROUND_BODY = '#1f3f45'
const PAPER = '#fdf7ec'
const PAPER_FOLD = '#d9cdb8'
const INK = '#2b2244'

const hillY = (x, seed, amp, base) =>
  base - amp * (0.55 * Math.sin(x * 0.011 + seed) + 0.3 * Math.sin(x * 0.027 + seed * 2.3) + 0.15 * Math.sin(x * 0.06 + seed * 5.1))

function drawHills(c, scroll, factor, seed, amp, base, color) {
  const off = scroll * factor
  c.fillStyle = color
  c.beginPath()
  c.moveTo(0, GROUND)
  for (let x = 0; x <= W; x += 8) c.lineTo(x, hillY(x + off, seed, amp, base))
  c.lineTo(W, GROUND)
  c.closePath()
  c.fill()
}

function drawClouds(c, scroll) {
  c.fillStyle = 'rgba(255, 235, 225, 0.22)'
  for (let i = 0; i < 4; i++) {
    const span = W + 160
    const x = ((i * 137 - scroll * 0.12) % span + span) % span - 80
    const y = 70 + ((i * 53) % 140)
    c.beginPath()
    c.ellipse(x, y, 46, 11, 0, 0, Math.PI * 2)
    c.ellipse(x + 26, y - 6, 28, 9, 0, 0, Math.PI * 2)
    c.fill()
  }
}

function drawPillarPart(c, x, y, h, capAtBottom) {
  const w = CFG.pillarW
  c.fillStyle = STONE
  c.fillRect(x + 4, y, w - 8, h)
  // shadow on the side away from the sun, warm rim light on the sun side
  c.fillStyle = STONE_SHADE
  c.fillRect(x + 4, y, 12, h)
  c.fillStyle = STONE_RIM
  c.globalAlpha = 0.85
  c.fillRect(x + w - 7, y, 3, h)
  c.globalAlpha = 1
  // stone courses
  c.fillStyle = STONE_COURSE
  const start = capAtBottom ? y + h : y
  for (let k = 1; k * 34 < h; k++) {
    const yy = capAtBottom ? start - k * 34 : start + k * 34
    c.fillRect(x + 4, yy, w - 8, 2)
  }
  // cap, with a glowing edge facing the gap
  const capY = capAtBottom ? y + h - 16 : y
  c.fillStyle = STONE_CAP
  c.beginPath()
  c.roundRect(x, capY, w, 16, 4)
  c.fill()
  c.fillStyle = CAP_GLOW
  c.fillRect(x + 3, capAtBottom ? capY + 13 : capY + 1, w - 6, 2)
  c.fillStyle = STONE_RIM
  c.fillRect(x + w - 4, capY + 3, 2, 10)
}

function drawPlane(c, g) {
  const tilt = g.mode === 'ready' ? Math.sin(g.t * 3) * 0.08 : Math.max(-0.5, Math.min(1.1, g.vy / 600))
  c.save()
  c.translate(CFG.planeX, g.y)
  c.rotate(tilt)
  // wake
  if (g.mode !== 'over') {
    c.strokeStyle = 'rgba(255, 245, 230, 0.35)'
    c.lineWidth = 2
    c.setLineDash([4, 6])
    c.beginPath()
    c.moveTo(-18, 2)
    c.lineTo(-46, 4)
    c.stroke()
    c.setLineDash([])
  }
  // lower wing
  c.fillStyle = PAPER_FOLD
  c.beginPath()
  c.moveTo(20, 0)
  c.lineTo(-16, 10)
  c.lineTo(-8, 1)
  c.closePath()
  c.fill()
  // upper wing
  c.fillStyle = PAPER
  c.beginPath()
  c.moveTo(20, 0)
  c.lineTo(-18, -12)
  c.lineTo(-8, 1)
  c.closePath()
  c.fill()
  c.strokeStyle = INK
  c.lineWidth = 1.2
  c.lineJoin = 'round'
  c.beginPath()
  c.moveTo(20, 0); c.lineTo(-18, -12); c.lineTo(-8, 1); c.lineTo(-16, 10); c.closePath()
  c.moveTo(20, 0); c.lineTo(-8, 1)
  c.stroke()
  c.restore()
}

function text(c, s, x, y, size, align = 'center', color = '#fff8ee') {
  c.font = `800 ${size}px ui-rounded, system-ui, -apple-system, sans-serif`
  c.textAlign = align
  c.textBaseline = 'middle'
  c.lineWidth = Math.max(3, size / 7)
  c.lineJoin = 'round'
  c.strokeStyle = 'rgba(30, 20, 60, 0.75)'
  c.strokeText(s, x, y)
  c.fillStyle = color
  c.fillText(s, x, y)
}

function card(c, x, y, w, h) {
  c.fillStyle = 'rgba(30, 22, 60, 0.72)'
  c.beginPath()
  c.roundRect(x, y, w, h, 16)
  c.fill()
}

function render(c, g, best, paused) {
  const sky = c.createLinearGradient(0, 0, 0, GROUND)
  SKY.forEach((col, i) => sky.addColorStop(i / (SKY.length - 1), col))
  c.fillStyle = sky
  c.fillRect(0, 0, W, H)

  // sun
  c.fillStyle = 'rgba(255, 214, 160, 0.9)'
  c.beginPath()
  c.arc(W * 0.72, GROUND - 150, 54, 0, Math.PI * 2)
  c.fill()

  drawClouds(c, g.scroll)
  drawHills(c, g.scroll, 0.2, 1.7, 60, GROUND - 90, HILL_FAR)
  drawHills(c, g.scroll, 0.45, 4.2, 40, GROUND - 30, HILL_NEAR)

  for (const p of g.pillars) {
    const top = p.gapY - p.gap / 2
    const bottom = p.gapY + p.gap / 2
    drawPillarPart(c, p.x, 0, top, true)
    drawPillarPart(c, p.x, bottom, GROUND - bottom, false)
  }

  // ground
  c.fillStyle = GROUND_BODY
  c.fillRect(0, GROUND, W, H - GROUND)
  c.fillStyle = GROUND_TOP
  c.fillRect(0, GROUND, W, 10)
  c.fillStyle = 'rgba(255,255,255,0.08)'
  const off = g.scroll % 28
  for (let x = -off; x < W; x += 28) c.fillRect(x, GROUND + 18, 14, 3)

  drawPlane(c, g)

  if (g.mode === 'playing') text(c, String(g.score), W / 2, 64, 52)

  if (g.mode === 'ready') {
    text(c, 'UPDRAFT', W / 2, 150, 46)
    text(c, 'Click, tap or press Space to fly', W / 2, 200, 17)
    if (best > 0) text(c, `Best ${best}`, W / 2, 232, 17, 'center', '#ffd6a0')
  }

  if (g.mode === 'over' && g.t - g.overAt > 0.25) {
    card(c, W / 2 - 130, 170, 260, 210)
    text(c, 'Grounded', W / 2, 208, 32, 'center', '#ffd6a0')
    text(c, 'Score', W / 2 - 60, 258, 15)
    text(c, 'Best', W / 2 + 60, 258, 15)
    text(c, String(g.score), W / 2 - 60, 295, 38)
    text(c, String(best), W / 2 + 60, 295, 38, 'center', g.score >= best && g.score > 0 ? '#ffd6a0' : '#fff8ee')
    if (g.score >= best && g.score > 0) text(c, 'New best!', W / 2, 332, 15, 'center', '#ffd6a0')
    if (g.t - g.overAt > CFG.restartDelay) text(c, 'Space to fly again', W / 2, 360, 14)
  }

  if (paused) {
    c.fillStyle = 'rgba(20, 14, 40, 0.45)'
    c.fillRect(0, 0, W, H)
    text(c, 'Paused', W / 2, H / 2 - 16, 40)
    text(c, 'P or click to resume', W / 2, H / 2 + 22, 16)
  }
}

// ── best score: host storage, with localStorage as a fallback ────────────
function readLocalBest() {
  try { return Number.parseInt(localStorage.getItem(LS_BEST) ?? '0', 10) || 0 } catch { return 0 }
}
function writeLocalBest(v) {
  try { localStorage.setItem(LS_BEST, String(v)) } catch {}
}

const isEditable = el => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

export function UpdraftPage() {
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const [size, setSize] = useState({ w: W, h: H })

  // Fit the 2:3 playfield inside the stage.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const ro = new ResizeObserver(() => {
      const r = stage.getBoundingClientRect()
      const scale = Math.max(0.5, Math.min(r.width / W, r.height / H, 1.6))
      setSize({ w: Math.round(W * scale), h: Math.round(H * scale) })
    })
    ro.observe(stage)
    return () => ro.disconnect()
  }, [])

  // Game loop, input and persistence.
  useEffect(() => {
    const canvas = canvasRef.current
    const c = canvas.getContext('2d')
    let g = createGame()
    let best = readLocalBest()
    let paused = false
    let last = performance.now()
    let raf = 0
    const ac = new AbortController()

    call('state', {}, ac.signal).then(s => {
      if (s.best > best) best = s.best
      writeLocalBest(best)
    }).catch(() => {})

    const onCrash = score => {
      if (score > best) { best = score; writeLocalBest(best) }
      call('finish', { score }, ac.signal).then(s => { if (s?.best > best) best = s.best }).catch(() => {})
    }

    const press = () => {
      if (paused) { paused = false; last = performance.now(); return }
      g = flap(g)
    }
    const togglePause = () => {
      if (g.mode !== 'playing') return
      paused = !paused
      last = performance.now()
    }

    const frame = now => {
      const dt = (now - last) / 1000
      last = now
      if (!paused) {
        const was = g.mode
        step(g, dt)
        if (was === 'playing' && g.mode === 'over') onCrash(g.score)
      }
      const dpr = window.devicePixelRatio || 1
      const pw = Math.round(canvas.clientWidth * dpr)
      const ph = Math.round(canvas.clientHeight * dpr)
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph }
      c.setTransform(pw / W, 0, 0, ph / H, 0, 0)
      render(c, g, best, paused)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    const onKey = e => {
      if (e.repeat || isEditable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); press() }
      else if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); togglePause() }
    }
    const onPointer = e => { e.preventDefault(); canvas.focus({ preventScroll: true }); press() }
    const onBlur = () => { if (g.mode === 'playing') paused = true }

    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onBlur)
    canvas.addEventListener('pointerdown', onPointer)
    canvas.focus({ preventScroll: true })
    return () => {
      ac.abort()
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
      canvas.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  return (
    <div className="dshup-root">
      <header className="dshup-head">
        <h1>Updraft</h1>
        <span>Space / ↑ / click to flap · P to pause</span>
      </header>
      <div className="dshup-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="dshup-canvas" tabIndex={0} aria-label="Updraft game"
          style={{ width: size.w, height: size.h }} />
      </div>
    </div>
  )
}

export function UpdraftIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M18 3 2 9l6 2 2 6 8-14Z" />
      <path d="M8 11 18 3" />
    </svg>
  )
}

export const name = 'dsh-updraft'
export const inject = ['slots']

export function apply(ctx) {
  bindConnection(ctx)

  ctx.effect(() => {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return () => {}
    const el = document.createElement('style')
    el.id = STYLE_ID
    el.textContent = CSS
    document.head.appendChild(el)
    return () => el.remove()
  }, 'dsh-updraft: styles')

  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, UpdraftPage))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 30,
    label: () => 'Updraft',
  }, UpdraftIcon))
}
