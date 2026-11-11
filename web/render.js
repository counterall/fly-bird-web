// Canvas renderer for Updraft. Draws one frame of a game from game.js onto a
// 2D context already scaled to the W×H logical playfield.
import { CFG, GROUND, H, W } from './game.js'

// ── palette ────────────────────────────────────────────────────────────────
const SKY = ['#2b2560', '#5b3f86', '#c4627a', '#f4a76a']
const SKY_NIGHT = '#1a1640' // top of the extra sky on tall screens
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
// Magpie: black with white belly and shoulder, blue-green sheen on wing and tail.
const MAG_BLACK = '#17161d'
const MAG_WHITE = '#f7f2ea'
const MAG_SHEEN_WING = '#2f4f8f'
const MAG_SHEEN_TAIL = '#2c6a6c'
const RIM = 'rgba(255, 196, 150, 0.5)' // warm sunset rim light

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

/** Wing angle in radians: positive raises the wing tip. */
function wingAngle(g) {
  if (g.mode === 'ready') return Math.sin(g.t * 11) * 0.7
  if (g.mode === 'over') return 0.9
  const since = g.t - g.flapAt
  const beat = 0.28 // one full wing beat after each flap
  if (since >= 0 && since < beat) return Math.sin((since / beat) * Math.PI * 2 + Math.PI / 2) * 0.85
  return -0.1 // glide
}

function drawMagpie(c, g) {
  const tilt = g.mode === 'ready' ? Math.sin(g.t * 3) * 0.06 : Math.max(-0.45, Math.min(1.2, g.vy / 600))
  c.save()
  c.translate(CFG.birdX, g.y)
  c.rotate(tilt)
  c.scale(1.3, 1.3) // drawn in a ~30px unit box; scaled up for readability
  c.lineJoin = 'round'

  // short tail: the body ends at x = -14; the tail tip sits at -21
  c.fillStyle = MAG_BLACK
  c.beginPath()
  c.moveTo(-8, -2)
  c.lineTo(-18, -2)
  c.quadraticCurveTo(-24, 1.5, -18, 5)
  c.lineTo(-8, 5)
  c.closePath()
  c.fill()
  c.strokeStyle = MAG_SHEEN_TAIL
  c.lineWidth = 1.6
  c.beginPath()
  c.moveTo(-13, 1.5)
  c.lineTo(-19, 1.5)
  c.stroke()

  // far wing (behind body), mirrored and darker
  drawWing(c, -wingAngle(g) * 0.6, true)

  // body
  c.fillStyle = MAG_BLACK
  c.beginPath()
  c.ellipse(0, 1, 14, 9, 0, 0, Math.PI * 2)
  c.fill()
  // white belly
  c.fillStyle = MAG_WHITE
  c.beginPath()
  c.ellipse(1, 5, 9, 4.5, -0.1, 0, Math.PI * 2)
  c.fill()

  // head
  c.fillStyle = MAG_BLACK
  c.beginPath()
  c.arc(12, -4, 7, 0, Math.PI * 2)
  c.fill()
  // beak
  c.fillStyle = '#2b2a31'
  c.beginPath()
  c.moveTo(17.5, -6)
  c.lineTo(25, -3.5)
  c.lineTo(17.5, -1.5)
  c.closePath()
  c.fill()
  // eye
  if (g.mode === 'over') {
    c.strokeStyle = MAG_WHITE
    c.lineWidth = 1.3
    c.beginPath()
    c.moveTo(12.5, -7.5); c.lineTo(15.5, -4.5)
    c.moveTo(15.5, -7.5); c.lineTo(12.5, -4.5)
    c.stroke()
  } else {
    c.fillStyle = '#fff'
    c.beginPath()
    c.arc(14, -6, 1.9, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#0b0a0f'
    c.beginPath()
    c.arc(14.5, -6, 1.1, 0, Math.PI * 2)
    c.fill()
  }

  // sunset rim light along the back of the head and body
  c.strokeStyle = RIM
  c.lineWidth = 1.2
  c.beginPath()
  c.arc(12, -4, 6.6, -Math.PI * 0.8, -Math.PI * 0.35)
  c.stroke()

  // near wing (in front of body)
  drawWing(c, wingAngle(g), false)
  c.restore()
}

/** Wing pivots at the shoulder and points backwards. */
function drawWing(c, angle, far) {
  c.save()
  c.translate(2, -2)
  c.rotate(-angle)
  c.fillStyle = far ? '#0f0e14' : MAG_BLACK
  c.beginPath()
  c.moveTo(4, -1)
  c.quadraticCurveTo(-6, -9, -21, -4)
  c.lineTo(-17, 1)
  c.quadraticCurveTo(-6, 5, 4, 3)
  c.closePath()
  c.fill()
  if (!far) {
    // white shoulder patch and blue sheen on the flight feathers
    c.fillStyle = MAG_WHITE
    c.beginPath()
    c.ellipse(-3, 0, 6, 2.6, -0.15, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = MAG_SHEEN_WING
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(-10, -3.5)
    c.quadraticCurveTo(-15, -4.5, -19, -3)
    c.stroke()
  }
  c.restore()
}

function text(c, s, x, y, size, color = '#fff8ee') {
  c.font = `800 ${size}px ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif`
  c.textAlign = 'center'
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

const GOLD = '#ffd6a0'

// Faint stars for the extra sky a tall screen shows above the playfield.
const STARS = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 97.3) % W,
  y: 110 - ((i * 61.7) % 420),
  r: 0.6 + ((i * 7) % 5) * 0.18,
  phase: i * 1.7,
}))

function drawStars(c, top, t) {
  for (const s of STARS) {
    if (s.y < -top) continue
    // fade out towards the warmer part of the sky
    const fade = Math.max(0, Math.min(1, (120 - s.y) / 160))
    c.globalAlpha = fade * (0.45 + 0.25 * Math.sin(t * 1.3 + s.phase))
    c.fillStyle = '#fff4e6'
    c.beginPath()
    c.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    c.fill()
  }
  c.globalAlpha = 1
}

/**
 * Draw one frame. `view.top` / `view.bottom` are extra logical pixels shown
 * above y = 0 and below y = H on screens taller than 2:3 (phones); the
 * playfield itself is unchanged, the sky and ground just extend.
 */
export function render(c, g, best, paused, touch, view = { top: 0, bottom: 0 }) {
  const top = view.top
  const bottom = H + view.bottom
  const sky = c.createLinearGradient(0, -top, 0, GROUND)
  const span = GROUND + top
  sky.addColorStop(0, top > 0 ? SKY_NIGHT : SKY[0])
  SKY.forEach((col, i) => sky.addColorStop((top + (i / (SKY.length - 1)) * GROUND) / span, col))
  c.fillStyle = sky
  c.fillRect(0, -top, W, bottom + top)
  drawStars(c, top, g.t)

  // sun
  c.fillStyle = 'rgba(255, 214, 160, 0.9)'
  c.beginPath()
  c.arc(W * 0.72, GROUND - 150, 54, 0, Math.PI * 2)
  c.fill()

  drawClouds(c, g.scroll)
  drawHills(c, g.scroll, 0.2, 1.7, 60, GROUND - 90, HILL_FAR)
  drawHills(c, g.scroll, 0.45, 4.2, 40, GROUND - 30, HILL_NEAR)

  for (const p of g.pillars) {
    const gapTop = p.gapY - p.gap / 2
    const gapBottom = p.gapY + p.gap / 2
    drawPillarPart(c, p.x, -view.top, gapTop + view.top, true)
    drawPillarPart(c, p.x, gapBottom, GROUND - gapBottom, false)
  }

  // ground
  c.fillStyle = GROUND_BODY
  c.fillRect(0, GROUND, W, bottom - GROUND)
  c.fillStyle = GROUND_TOP
  c.fillRect(0, GROUND, W, 10)
  c.fillStyle = 'rgba(255,255,255,0.08)'
  const off = g.scroll % 28
  for (let x = -off; x < W; x += 28) c.fillRect(x, GROUND + 18, 14, 3)

  drawMagpie(c, g)

  const again = touch ? 'Tap to fly again' : 'Space to fly again'
  if (g.mode === 'playing') text(c, String(g.score), W / 2, 64, 52)

  if (g.mode === 'ready') {
    text(c, 'UPDRAFT', W / 2, 150, 46)
    text(c, touch ? 'Tap to fly' : 'Click or press Space to fly', W / 2, 200, 17)
    if (best > 0) text(c, `Best ${best}`, W / 2, 232, 17, GOLD)
  }

  if (g.mode === 'over' && g.t - g.overAt > 0.25) {
    const isBest = g.score >= best && g.score > 0
    card(c, W / 2 - 130, 170, 260, 210)
    text(c, 'Grounded', W / 2, 208, 32, GOLD)
    text(c, 'Score', W / 2 - 60, 258, 15)
    text(c, 'Best', W / 2 + 60, 258, 15)
    text(c, String(g.score), W / 2 - 60, 295, 38)
    text(c, String(best), W / 2 + 60, 295, 38, isBest ? GOLD : '#fff8ee')
    if (isBest) text(c, 'New best!', W / 2, 332, 15, GOLD)
    if (g.t - g.overAt > CFG.restartDelay) text(c, again, W / 2, 360, 14)
  }

  if (paused) {
    c.fillStyle = 'rgba(20, 14, 40, 0.45)'
    c.fillRect(0, -top, W, bottom + top)
    text(c, 'Paused', W / 2, H / 2 - 16, 40)
    text(c, touch ? 'Tap to resume' : 'P or click to resume', W / 2, H / 2 + 22, 16)
  }
}
