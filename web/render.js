// Canvas renderer for Updraft. Draws one frame of a game from game.js onto a
// 2D context already scaled to the W×H logical playfield.
import { CFG, GROUND, H, W, medalFor, nextMedal } from './game.js'
import { paintMagpie } from './magpie.js'

// ── palette ────────────────────────────────────────────────────────────────
// The sky turns from dusk to night over a run; *_NIGHT is the far end.
const SKY = ['#2b2560', '#5b3f86', '#c4627a', '#f4a76a']
const SKY_NIGHT = ['#0e0c26', '#1b1946', '#2c2862', '#4a3a6e']
const SKY_TOP = '#1a1640' // top of the extra sky on tall screens
const SKY_TOP_NIGHT = '#08071a'
const SUN = [255, 214, 160]
const SUN_NIGHT = [240, 130, 96] // reddens as it sets
const MOON = '#f3ecdc'
const STAR = '#fff4e6'
const HILL_FAR = '#6a4a86'
const HILL_FAR_NIGHT = '#2f2752'
const HILL_NEAR = '#3d3268'
const HILL_NEAR_NIGHT = '#1d1838'
// Pillars: dusk-lit plum stone, rim-lit on the sun side (right) in peach.
const STONE = '#523b7c'
const STONE_SHADE = '#3c2b5f'
const STONE_RIM = '#f4a77a'
const STONE_COURSE = 'rgba(255, 200, 170, 0.10)'
const STONE_CAP = '#664a92'
const CAP_GLOW = '#ffc993'
const GROUND_TOP = '#2c5a5a'
const GROUND_TOP_NIGHT = '#1e4141'
const GROUND_BODY = '#1f3f45'
const GROUND_BODY_NIGHT = '#152c31'
const GROUND_STRIPE = 'rgba(255, 255, 255, 0.08)'
// Overlays
const INK = '#fff8ee'
const INK_OUTLINE = 'rgba(30, 20, 60, 0.75)'
const GOLD = '#ffd6a0'
const CARD = 'rgba(30, 22, 60, 0.72)'
const DIM = 'rgba(20, 14, 40, 0.45)'
// Medals: face and rim
const MEDAL = {
  bronze: ['#d99a62', '#94582c'],
  silver: ['#dde1ea', '#949cae'],
  gold: ['#ffd66e', '#c48a1a'],
}

const MAGPIE_SCALE = 1.3 // visual only; collisions use CFG.birdR
const NIGHT_DIST = 45 * CFG.spacing // distance flown by full night: ~45 points
const MEDAL_TOAST = 1.6 // s the "medal!" message shows after earning one

/** The sound toggle, top-right, in logical units; main.js hit-tests it. */
export const MUTE_BUTTON = { x: W - 30, y: 30, r: 22 }

// ── colour helpers ─────────────────────────────────────────────────────────
const rgb = hex => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16))
const lerp = (a, b, t) => a + (b - a) * t
/** Mix two #rrggbb colours (or [r, g, b] arrays); t = 0 gives a. */
function mix(a, b, t, alpha = 1) {
  const [ar, ag, ab] = typeof a === 'string' ? rgb(a) : a
  const [br, bg, bb] = typeof b === 'string' ? rgb(b) : b
  return `rgba(${Math.round(lerp(ar, br, t))}, ${Math.round(lerp(ag, bg, t))}, ${Math.round(lerp(ab, bb, t))}, ${alpha})`
}
const clamp01 = x => Math.max(0, Math.min(1, x))
const smooth = x => x * x * (3 - 2 * x)

/** 0 at dusk, 1 at full night; follows the distance flown this run. */
const nightFor = g => smooth(clamp01(g.dist / NIGHT_DIST))

// ── background ─────────────────────────────────────────────────────────────
function drawSky(c, top, ground, bottom, night) {
  const sky = c.createLinearGradient(0, -top, 0, ground)
  const span = ground + top
  sky.addColorStop(0, top > 0 ? mix(SKY_TOP, SKY_TOP_NIGHT, night) : mix(SKY[0], SKY_NIGHT[0], night))
  SKY.forEach((col, i) => sky.addColorStop((top + (i / (SKY.length - 1)) * ground) / span, mix(col, SKY_NIGHT[i], night)))
  c.fillStyle = sky
  c.fillRect(0, -top, W, bottom + top)
}

// Faint stars: at dusk only in the extra sky a tall screen shows above the
// playfield; they come out lower down as night falls.
const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 97.3) % W,
  y: 430 - ((i * 61.7) % 850),
  r: 0.6 + ((i * 7) % 5) * 0.18,
  phase: i * 1.7,
}))

function drawStars(c, top, t, night) {
  c.fillStyle = STAR
  const limit = 120 + night * 300 // stars fade out below this line
  for (const s of STARS) {
    if (s.y < -top) continue
    // fade out towards the warmer part of the sky
    const fade = clamp01((limit - s.y) / 160)
    if (fade === 0) continue
    c.globalAlpha = fade * (0.45 + 0.25 * Math.sin(t * 1.3 + s.phase))
    c.beginPath()
    c.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    c.fill()
  }
  c.globalAlpha = 1
}

/** The sun sinks behind the hills as night falls. */
function drawSun(c, night) {
  c.fillStyle = mix(SUN, SUN_NIGHT, night, 0.9)
  c.beginPath()
  c.arc(W * 0.72, lerp(GROUND - 150, GROUND + 60, night), 54, 0, Math.PI * 2)
  c.fill()
}

/** A crescent moon that fades in over the second half of the run to night. */
function drawMoon(c, night) {
  const a = clamp01((night - 0.4) / 0.5)
  if (a === 0) return
  const x = 86
  const y = 104
  c.save()
  c.globalAlpha = a
  const halo = c.createRadialGradient(x, y, 12, x, y, 44)
  halo.addColorStop(0, 'rgba(243, 236, 220, 0.16)')
  halo.addColorStop(1, 'rgba(243, 236, 220, 0)')
  c.fillStyle = halo
  c.beginPath()
  c.arc(x, y, 44, 0, Math.PI * 2)
  c.fill()
  // crescent: the disc, minus a second disc offset towards the upper right
  c.beginPath()
  c.arc(x, y, 15, 0, Math.PI * 2)
  c.clip()
  c.fillStyle = MOON
  c.beginPath()
  c.rect(x - 16, y - 16, 32, 32)
  c.arc(x + 7, y - 4, 13, 0, Math.PI * 2)
  c.fill('evenodd')
  c.restore()
}

function drawClouds(c, scroll, night) {
  c.fillStyle = `rgba(255, 235, 225, ${lerp(0.22, 0.1, night)})`
  const span = W + 160
  for (let i = 0; i < 4; i++) {
    const x = ((i * 137 - scroll * 0.12) % span + span) % span - 80
    const y = 70 + ((i * 53) % 140)
    c.beginPath()
    c.ellipse(x, y, 46, 11, 0, 0, Math.PI * 2)
    c.ellipse(x + 26, y - 6, 28, 9, 0, 0, Math.PI * 2)
    c.fill()
  }
}

const hillY = (x, seed, amp, base) =>
  base - amp * (0.55 * Math.sin(x * 0.011 + seed) + 0.3 * Math.sin(x * 0.027 + seed * 2.3) + 0.15 * Math.sin(x * 0.06 + seed * 5.1))

/** A parallax hill layer scrolling at `factor` × the pillars' speed. */
function drawHills(c, scroll, factor, seed, amp, base, color, ground) {
  const off = scroll * factor
  c.fillStyle = color
  c.beginPath()
  c.moveTo(0, ground)
  for (let x = 0; x <= W; x += 8) c.lineTo(x, hillY(x + off, seed, amp, base))
  c.lineTo(W, ground)
  c.closePath()
  c.fill()
}

// ── pillars and ground ─────────────────────────────────────────────────────
const COURSE_H = 34 // height of one course of stone blocks

/** One pillar half from y to y + h; the cap sits on the end facing the gap. */
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
  // stone courses, counted from the cap so they line up with it
  c.fillStyle = STONE_COURSE
  for (let k = 1; k * COURSE_H < h; k++) {
    const yy = capAtBottom ? y + h - k * COURSE_H : y + k * COURSE_H
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

function drawPillars(c, pillars, top, ground) {
  for (const p of pillars) {
    const gapTop = p.gapY - p.gap / 2
    const gapBottom = p.gapY + p.gap / 2
    drawPillarPart(c, p.x, -top, gapTop + top, true)
    drawPillarPart(c, p.x, gapBottom, ground - gapBottom, false)
  }
}

function drawGround(c, scroll, ground, bottom, night) {
  c.fillStyle = mix(GROUND_BODY, GROUND_BODY_NIGHT, night)
  c.fillRect(0, ground, W, bottom - ground)
  c.fillStyle = mix(GROUND_TOP, GROUND_TOP_NIGHT, night)
  c.fillRect(0, ground, W, 10)
  c.fillStyle = GROUND_STRIPE
  const off = scroll % 28
  for (let x = -off; x < W; x += 28) c.fillRect(x, ground + 18, 14, 3)
}

// ── the magpie in play ─────────────────────────────────────────────────────
/** Wing angle in radians: positive raises the wing tip. */
function wingAngle(g) {
  if (g.mode === 'ready') return Math.sin(g.t * 11) * 0.7
  if (g.mode === 'over') return 0.9
  const since = g.t - g.flapAt
  const beat = 0.28 // one full wing beat after each flap
  if (since >= 0 && since < beat) return Math.sin((since / beat) * Math.PI * 2 + Math.PI / 2) * 0.85
  return -0.1 // glide
}

/** Nose up when climbing, down when falling. */
function tiltFor(g) {
  if (g.mode === 'ready') return Math.sin(g.t * 3) * 0.06
  return Math.max(-0.45, Math.min(1.2, g.vy / 600))
}

function drawMagpie(c, g) {
  paintMagpie(c, CFG.birdX, g.y, tiltFor(g), MAGPIE_SCALE, wingAngle(g), g.mode === 'over')
}

// ── overlays ───────────────────────────────────────────────────────────────
function text(c, s, x, y, size, color = INK) {
  c.font = `800 ${size}px ui-rounded, system-ui, -apple-system, "Segoe UI", sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.lineWidth = Math.max(3, size / 7)
  c.lineJoin = 'round'
  c.strokeStyle = INK_OUTLINE
  c.strokeText(s, x, y)
  c.fillStyle = color
  c.fillText(s, x, y)
  return c.measureText(s).width
}

function card(c, x, y, w, h) {
  c.fillStyle = CARD
  c.beginPath()
  c.roundRect(x, y, w, h, 16)
  c.fill()
}

const capital = s => s[0].toUpperCase() + s.slice(1)

/** A medal of the given tier ('bronze' | 'silver' | 'gold'), or an empty slot. */
function drawMedal(c, x, y, r, tier) {
  c.save()
  if (!tier) {
    c.strokeStyle = 'rgba(255, 248, 238, 0.25)'
    c.lineWidth = 2
    c.setLineDash([4, 4])
    c.beginPath()
    c.arc(x, y, r - 1, 0, Math.PI * 2)
    c.stroke()
    c.restore()
    return
  }
  const [face, rim] = MEDAL[tier]
  c.fillStyle = rim
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = face
  c.beginPath()
  c.arc(x, y, r * 0.8, 0, Math.PI * 2)
  c.fill()
  // embossed five-pointed star
  c.fillStyle = rim
  c.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.22 : r * 0.5
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  c.closePath()
  c.fill()
  // shine
  c.strokeStyle = 'rgba(255, 255, 255, 0.45)'
  c.lineWidth = Math.max(1, r * 0.08)
  c.beginPath()
  c.arc(x, y, r * 0.68, Math.PI * 1.05, Math.PI * 1.45)
  c.stroke()
  c.restore()
}

function drawTitle(c, best, touch) {
  text(c, 'UPDRAFT', W / 2, 150, 46)
  text(c, touch ? 'Tap to fly' : 'Click or press Space to fly', W / 2, 200, 17)
  if (best > 0) {
    const w = text(c, `Best ${best}`, W / 2, 232, 17, GOLD)
    const medal = medalFor(best)
    if (medal) drawMedal(c, W / 2 - w / 2 - 16, 232, 9, medal.name)
  }
  if (!touch) text(c, 'P to pause · M for sound', W / 2, 300, 13, 'rgba(255, 248, 238, 0.7)')
}

/** "Bronze medal!" under the score, just after a run earns a medal. */
function drawMedalToast(c, g) {
  const medal = medalFor(g.score)
  if (!medal || medal.score !== g.score || g.t - g.scoredAt > MEDAL_TOAST) return
  const k = (g.t - g.scoredAt) / MEDAL_TOAST
  c.globalAlpha = k < 0.8 ? 1 : (1 - k) / 0.2
  drawMedal(c, W / 2 - 78, 112, 11, medal.name)
  text(c, `${capital(medal.name)} medal!`, W / 2 + 12, 112, 20, MEDAL[medal.name][0])
  c.globalAlpha = 1
}

function drawGameOver(c, g, best, touch) {
  const since = g.t - g.overAt
  if (since <= 0.25) return // let the crash register first
  const isBest = g.score >= best && g.score > 0
  const medal = medalFor(g.score)
  const next = nextMedal(g.score)
  card(c, W / 2 - 150, 166, 300, 222)
  text(c, 'Grounded', W / 2, 204, 32, GOLD)
  // medal on the left, score and best on the right
  drawMedal(c, 115, 284, 30, medal?.name)
  text(c, medal ? capital(medal.name) : 'No medal', 115, 332, 13, medal ? MEDAL[medal.name][0] : 'rgba(255, 248, 238, 0.6)')
  text(c, 'Score', 215, 250, 15)
  text(c, 'Best', 295, 250, 15)
  text(c, String(g.score), 215, 286, 38)
  text(c, String(best), 295, 286, 38, isBest ? GOLD : INK)
  if (isBest) text(c, 'New best!', 255, 322, 15, GOLD)
  else if (next) text(c, `${capital(next.name)} at ${next.score}`, 255, 322, 13, 'rgba(255, 248, 238, 0.7)')
  if (since > CFG.restartDelay) text(c, touch ? 'Tap to fly again' : 'Space to fly again', W / 2, 364, 14)
}

/** Speaker icon, crossed out when muted. */
function drawMuteButton(c, muted) {
  const { x, y, r } = MUTE_BUTTON
  c.save()
  c.globalAlpha = 0.75
  c.fillStyle = 'rgba(30, 22, 60, 0.45)'
  c.beginPath()
  c.arc(x, y, r * 0.75, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = INK
  c.strokeStyle = INK
  c.lineWidth = 1.8
  c.lineCap = 'round'
  // speaker
  c.beginPath()
  c.moveTo(x - 8, y - 3); c.lineTo(x - 4, y - 3); c.lineTo(x + 1, y - 8)
  c.lineTo(x + 1, y + 8); c.lineTo(x - 4, y + 3); c.lineTo(x - 8, y + 3)
  c.closePath()
  c.fill()
  c.beginPath()
  if (muted) {
    c.moveTo(x + 4, y - 4); c.lineTo(x + 10, y + 4)
    c.moveTo(x + 10, y - 4); c.lineTo(x + 4, y + 4)
  } else {
    c.arc(x + 2, y, 5, -0.9, 0.9)
    c.moveTo(x + 2 + 9 * Math.cos(-0.9), y + 9 * Math.sin(-0.9))
    c.arc(x + 2, y, 9, -0.9, 0.9)
  }
  c.stroke()
  c.restore()
}

function drawPaused(c, top, bottom, touch) {
  c.fillStyle = DIM
  c.fillRect(0, -top, W, bottom + top)
  text(c, 'Paused', W / 2, H / 2 - 16, 40)
  text(c, touch ? 'Tap to resume' : 'P or click to resume', W / 2, H / 2 + 22, 16)
}

/**
 * Draw one frame. `ui` is { best, paused, touch, muted }. `view.top` /
 * `view.bottom` are extra logical pixels shown above y = 0 and below y = H on
 * screens taller than 2:3 (phones), and `view.ground` is the ground line
 * there. The playfield itself is unchanged; the sky and ground just extend.
 */
export function render(c, g, ui, view = { top: 0, bottom: 0, ground: GROUND }) {
  const { best, paused, touch, muted } = ui
  const top = view.top
  const bottom = H + view.bottom
  const ground = view.ground
  const night = nightFor(g)

  drawSky(c, top, ground, bottom, night)
  drawStars(c, top, g.t, night)
  drawMoon(c, night)
  drawSun(c, night)
  drawClouds(c, g.scroll, night)
  drawHills(c, g.scroll, 0.2, 1.7, 60, GROUND - 90, mix(HILL_FAR, HILL_FAR_NIGHT, night), ground)
  drawHills(c, g.scroll, 0.45, 4.2, 40, GROUND - 30, mix(HILL_NEAR, HILL_NEAR_NIGHT, night), ground)
  drawPillars(c, g.pillars, top, ground)
  drawGround(c, g.scroll, ground, bottom, night)
  drawMagpie(c, g)

  if (g.mode === 'playing') {
    text(c, String(g.score), W / 2, 64, 52)
    drawMedalToast(c, g)
  } else if (g.mode === 'ready') drawTitle(c, best, touch)
  else drawGameOver(c, g, best, touch)

  if (paused) drawPaused(c, top, bottom, touch)
  drawMuteButton(c, muted)
}

// ── app icon ───────────────────────────────────────────────────────────────
/**
 * App icon: square, full-bleed (iOS rounds the corners itself), drawn in a
 * 100×100 box scaled to `size`. `safe` shrinks the subject into the centre
 * for Android "maskable" icons, which may be cropped to a circle.
 */
export function drawIcon(c, size, safe = false) {
  c.save()
  c.scale(size / 100, size / 100)
  const sky = c.createLinearGradient(0, 0, 0, 100)
  sky.addColorStop(0, SKY_TOP)
  sky.addColorStop(0.35, SKY[1])
  sky.addColorStop(0.72, SKY[2])
  sky.addColorStop(1, SKY[3])
  c.fillStyle = sky
  c.fillRect(0, 0, 100, 100)
  const k = safe ? 0.78 : 1 // keep the subject inside the maskable safe zone
  c.translate(50 * (1 - k), 50 * (1 - k))
  c.scale(k, k)
  // stars
  c.fillStyle = 'rgba(255, 244, 230, 0.7)'
  for (const [sx, sy, r] of [[14, 12, 0.9], [30, 7, 0.6], [78, 10, 0.8], [88, 24, 0.6], [9, 30, 0.6]]) {
    c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill()
  }
  // sun and hills
  c.fillStyle = 'rgba(255, 214, 160, 0.95)'
  c.beginPath(); c.arc(72, 74, 17, 0, Math.PI * 2); c.fill()
  c.fillStyle = HILL_FAR
  c.beginPath()
  c.moveTo(-20, 120); c.lineTo(-20, 84)
  c.quadraticCurveTo(20, 68, 48, 86); c.quadraticCurveTo(80, 72, 120, 82)
  c.lineTo(120, 120); c.closePath(); c.fill()
  c.fillStyle = HILL_NEAR
  c.beginPath()
  c.moveTo(-20, 120); c.lineTo(-20, 96)
  c.quadraticCurveTo(30, 84, 62, 96); c.quadraticCurveTo(90, 88, 120, 94)
  c.lineTo(120, 120); c.closePath(); c.fill()
  // the magpie, mid wing-beat, climbing
  paintMagpie(c, 52, 48, -0.2, 1.6, -0.7, false)
  c.restore()
}
