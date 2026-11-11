// Pure game model for Updraft: no DOM, so it can be unit-tested with node --test.
// Coordinates are in a fixed logical playfield of W×H; the renderer scales it.

export const W = 400
export const H = 600
export const GROUND = 540 // y of the ground line on a 2:3 screen
export const START_Y = H * 0.42 // where the bird hovers before the first flap

const SPAWN_X = W + 10 // pillars enter just off the right edge…
const DESPAWN_X = -10 // …and are dropped once fully past the left edge

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
  shift: 110, // max change in gap height from one pillar to the next…
  shiftPerPoint: 4, // …widening with the score (the edges cap it)
  calmEvery: 10, // every this many pillars, a calm stretch…
  calmLength: 3, // …of this many pillars…
  calmShift: 24, // …whose gaps barely move
  restartDelay: 0.6, // s after crashing before a flap restarts
})

/**
 * A fresh game. `ceil` / `floor` are the top of the visible sky and the ground
 * line; main.js moves them out on screens taller than 2:3. `spawned` counts
 * pillars so far.
 */
export function createGame() {
  return { mode: 'ready', t: 0, y: START_Y, vy: 0, pillars: [], score: 0, scroll: 0, overAt: 0, flapAt: -1, spawned: 0, ceil: 0, floor: GROUND }
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
  g.vy = CFG.lift
  g.flapAt = g.t
  return g
}

/** Pillars that open a calm stretch: a breather after every `calmEvery`. */
export const isCalm = n => n >= CFG.calmEvery && n % CFG.calmEvery < CFG.calmLength

/** How far pillar n's gap may move from the previous one. */
export const shiftFor = (n, score) => isCalm(n) ? CFG.calmShift : CFG.shift + score * CFG.shiftPerPoint

function spawn(g, rand) {
  const gap = gapFor(g.score)
  const prev = g.pillars.at(-1)?.gapY ?? START_Y
  const shift = shiftFor(g.spawned, g.score)
  const lo = Math.max(CFG.edge + gap / 2, prev - shift)
  const hi = Math.min(GROUND - CFG.edge - gap / 2, prev + shift)
  g.pillars.push({ x: SPAWN_X, gapY: lo + rand() * (hi - lo), gap, passed: false })
  g.spawned++
}

/** Closest-point test between a circle and an axis-aligned rect. */
export function hitsRect(cx, cy, r, x, y, w, h) {
  const nx = Math.max(x, Math.min(cx, x + w))
  const ny = Math.max(y, Math.min(cy, y + h))
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r
}

export function collides(g) {
  const r = CFG.birdR
  if (g.y + r >= g.floor) return true
  for (const p of g.pillars) {
    const top = p.gapY - p.gap / 2
    const bottom = p.gapY + p.gap / 2
    // the top half reaches well above the playfield, so it can't be flown over
    if (hitsRect(CFG.birdX, g.y, r, p.x, -1000, CFG.pillarW, top + 1000)) return true
    if (hitsRect(CFG.birdX, g.y, r, p.x, bottom, CFG.pillarW, g.floor - bottom)) return true
  }
  return false
}

/** Keep the bird between the sky's top edge and the ground. */
function clampToSky(g) {
  if (g.y - CFG.birdR < g.ceil) { g.y = g.ceil + CFG.birdR; g.vy = 0 }
}
function clampToGround(g) {
  if (g.y + CFG.birdR > g.floor) { g.y = g.floor - CFG.birdR; g.vy = 0 }
}

function scrollPillars(g, dt, rand) {
  const dx = speedFor(g.score) * dt
  g.scroll += dx
  for (const p of g.pillars) {
    p.x -= dx
    if (!p.passed && p.x + CFG.pillarW < CFG.birdX - CFG.birdR) {
      p.passed = true
      g.score++
    }
  }
  g.pillars = g.pillars.filter(p => p.x + CFG.pillarW > DESPAWN_X)
  const last = g.pillars.at(-1)
  if (!last || last.x < SPAWN_X - CFG.spacing) spawn(g, rand)
}

/** Advance the game by dt seconds. Mutates and returns g. */
export function step(g, dt, rand = Math.random) {
  dt = Math.min(dt, 1 / 20) // don't tunnel through pillars after a stall
  g.t += dt

  if (g.mode === 'ready') {
    g.y = START_Y + Math.sin(g.t * 3) * 8
    g.scroll += CFG.speed * dt
    return g
  }

  // Gravity applies while playing and while the wreck falls after a crash.
  g.vy = Math.min(g.vy + CFG.gravity * dt, CFG.maxFall)
  g.y += g.vy * dt
  clampToSky(g)

  if (g.mode === 'over') {
    clampToGround(g)
    return g
  }

  scrollPillars(g, dt, rand)
  if (collides(g)) {
    g.mode = 'over'
    g.overAt = g.t
    clampToGround(g)
  }
  return g
}
