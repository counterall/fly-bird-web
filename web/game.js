// Pure game model for Updraft: no DOM, so it can be unit-tested with node --test.
// Coordinates are in a fixed logical playfield of W×H; the renderer scales it.

export const W = 400
export const H = 600
export const GROUND = 540 // y of the ground line

export const CFG = Object.freeze({
  gravity: 1500, // px/s²
  lift: -430, // vy set on each flap, px/s
  maxFall: 620, // terminal velocity, px/s
  speed: 150, // base scroll speed, px/s
  speedPerPoint: 2.5, // extra speed per point scored…
  speedCap: 70, // …up to this much extra
  gap: 172, // initial gap between pillar halves
  gapMin: 132, // gap shrinks by 1px per point down to this
  spacing: 215, // horizontal distance between pillars
  pillarW: 62,
  birdX: 110,
  birdR: 12, // collision radius of the bird's body (the tail doesn't collide)
  edge: 90, // min distance of a gap's centre from the top / the ground
  restartDelay: 0.6, // s after crashing before a flap restarts
})

export function createGame() {
  return { mode: 'ready', t: 0, y: H * 0.42, vy: 0, pillars: [], score: 0, scroll: 0, overAt: 0, flapAt: -1 }
}

export const speedFor = score => CFG.speed + Math.min(score * CFG.speedPerPoint, CFG.speedCap)
export const gapFor = score => Math.max(CFG.gapMin, CFG.gap - score)

/** Player input. Returns the game to keep using (a fresh one after a crash). */
export function flap(g) {
  if (g.mode === 'over') {
    if (g.t - g.overAt < CFG.restartDelay) return g
    g = createGame()
  }
  if (g.mode === 'ready') g.mode = 'playing'
  if (g.mode === 'playing') { g.vy = CFG.lift; g.flapAt = g.t }
  return g
}

function spawn(g, rand) {
  const gap = gapFor(g.score)
  const lo = CFG.edge + gap / 2
  const hi = GROUND - CFG.edge - gap / 2
  g.pillars.push({ x: W + 10, gapY: lo + rand() * (hi - lo), gap, passed: false })
}

/** Closest-point test between the plane's circle and an axis-aligned rect. */
export function hitsRect(cx, cy, r, x, y, w, h) {
  const nx = Math.max(x, Math.min(cx, x + w))
  const ny = Math.max(y, Math.min(cy, y + h))
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r
}

export function collides(g) {
  const r = CFG.birdR
  if (g.y + r >= GROUND) return true
  for (const p of g.pillars) {
    const top = p.gapY - p.gap / 2
    const bottom = p.gapY + p.gap / 2
    if (hitsRect(CFG.birdX, g.y, r, p.x, -1000, CFG.pillarW, top + 1000)) return true
    if (hitsRect(CFG.birdX, g.y, r, p.x, bottom, CFG.pillarW, GROUND - bottom)) return true
  }
  return false
}

/** Advance the game by dt seconds. Mutates and returns g. */
export function step(g, dt, rand = Math.random) {
  dt = Math.min(dt, 1 / 20) // don't tunnel through pillars after a stall
  g.t += dt

  if (g.mode === 'ready') {
    g.y = H * 0.42 + Math.sin(g.t * 3) * 8
    g.scroll += CFG.speed * dt
    return g
  }

  // Gravity applies while playing and while the wreck falls after a crash.
  g.vy = Math.min(g.vy + CFG.gravity * dt, CFG.maxFall)
  g.y += g.vy * dt
  if (g.y - CFG.birdR < 0) { g.y = CFG.birdR; g.vy = 0 }

  if (g.mode === 'over') {
    if (g.y + CFG.birdR > GROUND) { g.y = GROUND - CFG.birdR; g.vy = 0 }
    return g
  }

  const dx = speedFor(g.score) * dt
  g.scroll += dx
  for (const p of g.pillars) {
    p.x -= dx
    if (!p.passed && p.x + CFG.pillarW < CFG.birdX - CFG.birdR) {
      p.passed = true
      g.score++
    }
  }
  g.pillars = g.pillars.filter(p => p.x + CFG.pillarW > -10)
  const last = g.pillars[g.pillars.length - 1]
  if (!last || last.x < W + 10 - CFG.spacing) spawn(g, rand)

  if (collides(g)) {
    g.mode = 'over'
    g.overAt = g.t
    if (g.y + CFG.birdR > GROUND) { g.y = GROUND - CFG.birdR; g.vy = 0 }
  }
  return g
}
