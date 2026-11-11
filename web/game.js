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
  trinketR: 9, // pickup radius of a trinket (plus the bird's birdR)
  trinketInset: 32, // a trinket sits this far inside the gap from a pillar's cap
  trinketEvery: 7, // a trinket rides on every 7th pillar…
  trinketFirst: 4, // …starting with pillar 4 (counting from 0)
  ghostTime: 1.5, // s a hit bird passes through pillars before it can be hit again
  driftFrom: 5, // on levels with drifting pillars, gaps drift from pillar 5 (counting from 0)…
  drift: 30, // …by ± this many px at first…
  driftPerPillar: 2, // …widening with each pillar…
  driftMax: 56, // …up to this
  driftPeriod: 2.4, // s for one full up-and-down
  draftFrom: 13, // on levels with updrafts, one sits before pillar 13 (counting from 0)…
  draftEvery: 3, // …and every 3rd pillar after it, except in calm stretches
  draftW: 80, // width of an updraft column
  draftSpeed: 140, // the rising air carries the bird up this fast, px/s, at the column's middle…
  draftSpeedPerPillar: 2, // …faster with each pillar…
  draftSpeedMax: 200, // …up to this
})

/**
 * Difficulty levels. Each run is played at one; it never changes mid-run.
 * `lives`: lives at the start. `maxLives`: how many trinkets can stack up to.
 */
export const LEVEL = Object.freeze({
  easy: Object.freeze({ lives: 1, maxLives: 3, trinkets: true, drifting: false, updrafts: false }),
  hard: Object.freeze({ lives: 1, maxLives: 1, trinkets: false, drifting: true, updrafts: true }),
})
export const LEVELS = Object.freeze(Object.keys(LEVEL))

/** Medals for a run, lowest first. */
export const MEDALS = Object.freeze([
  { name: 'bronze', score: 10 },
  { name: 'silver', score: 25 },
  { name: 'gold', score: 50 },
])
export const medalFor = score => MEDALS.findLast(m => score >= m.score) ?? null
export const nextMedal = score => MEDALS.find(m => score < m.score) ?? null

/**
 * A fresh game at `level` (one of LEVELS).
 * - `phase`: 'ready' (hovering on the title screen), 'playing' or 'over'.
 * - `ceil` / `floor`: the top of the visible sky and the ground line; main.js
 *   moves them out on screens taller than 2:3.
 * - `spawned`: pillars so far. `dist`: distance flown. `scoredAt`: time of the
 *   last point.
 * - `drafts`: updraft columns ({ x, speed }); `inDraft`: the bird is in one.
 * - `lives`: lives left, including the current one. After a hit that isn't the
 *   last, the bird is a `ghost` (passes through pillars) from `hurtAt` on.
 */
export function createGame(level = 'easy') {
  return {
    level, phase: 'ready', t: 0, y: START_Y, vy: 0, pillars: [], score: 0, scroll: 0,
    overAt: 0, flapAt: -1, scoredAt: -1, spawned: 0, dist: 0, ceil: 0, floor: GROUND,
    lives: LEVEL[level].lives, ghost: false, hurtAt: -1, drafts: [], inDraft: false,
  }
}

export const speedFor = score => CFG.speed + Math.min(score * CFG.speedPerPoint, CFG.speedCap)
export const gapFor = score => Math.max(CFG.gapMin, CFG.gap - score)

/**
 * Player input. Returns the game to keep using: after a crash, a fresh one
 * back on the title screen, where the level can be changed.
 */
export function flap(g) {
  if (g.phase === 'over') return g.t - g.overAt < CFG.restartDelay ? g : createGame(g.level)
  if (g.phase === 'ready') g.phase = 'playing'
  g.vy = CFG.lift
  g.flapAt = g.t
  return g
}

/** Pillars that open a calm stretch: a breather after every `calmEvery`. */
export const isCalm = n => n >= CFG.calmEvery && n % CFG.calmEvery < CFG.calmLength

/** How far pillar n's gap may move from the previous one. */
export const shiftFor = (n, score) => isCalm(n) ? CFG.calmShift : CFG.shift + score * CFG.shiftPerPoint

/** Does pillar n carry a trinket? Only on levels that have them, and only when a life can be gained. */
export const hasTrinket = (g, n) =>
  LEVEL[g.level].trinkets && g.lives < LEVEL[g.level].maxLives &&
  n >= CFG.trinketFirst && (n - CFG.trinketFirst) % CFG.trinketEvery === 0

/** Where a pillar's trinket is: centred on it, near its top or bottom cap. */
export const trinketPos = p => ({
  x: p.x + CFG.pillarW / 2,
  y: p.gapY + p.trinket.side * (p.gap / 2 - CFG.trinketInset),
})

/** How far pillar n's gap drifts up and down (0: it stays put). Calm stretches stay put too. */
export function driftFor(level, n) {
  if (!LEVEL[level].drifting || n < CFG.driftFrom || isCalm(n)) return 0
  return Math.min(CFG.driftMax, CFG.drift + (n - CFG.driftFrom) * CFG.driftPerPillar)
}

/** How fast the updraft before pillar n rises (0: there isn't one). */
export function draftFor(level, n) {
  if (!LEVEL[level].updrafts || n < CFG.draftFrom || isCalm(n) || (n - CFG.draftFrom) % CFG.draftEvery) return 0
  return Math.min(CFG.draftSpeedMax, CFG.draftSpeed + (n - CFG.draftFrom) * CFG.draftSpeedPerPillar)
}

/**
 * How fast an updraft carries the bird up right now: full speed at the
 * column's middle, easing to 0 at its sides, so the ride is smooth.
 */
export function draftRise(d) {
  const u = (CFG.birdX - d.x) / CFG.draftW
  return u > 0 && u < 1 ? d.speed * Math.sin(Math.PI * u) : 0
}

/**
 * A pillar's gap is centred on `baseY`; a drifting one (`drift` > 0) swings
 * ± drift around it, and `gapY` is where it is right now.
 */
function spawn(g, rand) {
  const gap = gapFor(g.score)
  const edgeLo = CFG.edge + gap / 2
  const edgeHi = GROUND - CFG.edge - gap / 2
  const last = g.pillars.at(-1)
  const prev = last?.baseY ?? last?.gapY ?? START_Y
  // a drifting gap leaves room to swing inside the edges, and its drift eats
  // into the allowed jump, so the worst case stays fair
  const drift = Math.min(driftFor(g.level, g.spawned), (edgeHi - edgeLo) / 2)
  const shift = Math.max(CFG.calmShift, shiftFor(g.spawned, g.score) - drift)
  const lo = Math.max(edgeLo + drift, prev - shift)
  const hi = Math.min(edgeHi - drift, prev + shift)
  // lo > hi can't happen with the shipped CFG (shift - drift > drift), but
  // stay safe if it's retuned: then sit as close to prev as the edges allow
  const baseY = lo <= hi ? lo + rand() * (hi - lo) : Math.min(edgeHi - drift, Math.max(edgeLo + drift, prev))
  const p = { x: SPAWN_X, baseY, gapY: baseY, gap, passed: false, trinket: null, drift, phase: 0 }
  if (drift > 0) {
    p.phase = rand() * Math.PI * 2
    p.gapY = gapYAt(p, g.t)
  }
  // side: -1 near the top cap, 1 near the bottom one. takenAt: when collected.
  if (hasTrinket(g, g.spawned)) p.trinket = { side: rand() < 0.5 ? -1 : 1, takenAt: -1 }
  // an updraft fills the middle of the space before this pillar
  const speed = draftFor(g.level, g.spawned)
  if (speed && last) g.drafts.push({ x: (last.x + CFG.pillarW + SPAWN_X - CFG.draftW) / 2, speed })
  g.pillars.push(p)
  g.spawned++
}

/** The updraft the bird is in, if any. */
export const draftAt = g => g.drafts.find(d => CFG.birdX > d.x && CFG.birdX < d.x + CFG.draftW) ?? null

/** Where a pillar's gap is centred at time t. */
export const gapYAt = (p, t) =>
  p.drift ? p.baseY + p.drift * Math.sin(p.phase + (t * 2 * Math.PI) / CFG.driftPeriod) : p.gapY

/** Closest-point test between a circle and an axis-aligned rect. */
export function hitsRect(cx, cy, r, x, y, w, h) {
  const nx = Math.max(x, Math.min(cx, x + w))
  const ny = Math.max(y, Math.min(cy, y + h))
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r
}

export const hitsGround = g => g.y + CFG.birdR >= g.floor

export function hitsPillar(g) {
  const r = CFG.birdR
  for (const p of g.pillars) {
    const top = p.gapY - p.gap / 2
    const bottom = p.gapY + p.gap / 2
    // the top half reaches well above the playfield, so it can't be flown over
    if (hitsRect(CFG.birdX, g.y, r, p.x, -1000, CFG.pillarW, top + 1000)) return true
    if (hitsRect(CFG.birdX, g.y, r, p.x, bottom, CFG.pillarW, g.floor - bottom)) return true
  }
  return false
}

export const collides = g => hitsGround(g) || hitsPillar(g)

/** Pick up any trinket the bird touches: +1 life, up to the level's max. */
function collectTrinkets(g) {
  for (const p of g.pillars) {
    if (!p.trinket || p.trinket.takenAt >= 0) continue
    const { x, y } = trinketPos(p)
    if (Math.hypot(x - CFG.birdX, y - g.y) < CFG.birdR + CFG.trinketR) {
      p.trinket.takenAt = g.t
      g.lives = Math.min(g.lives + 1, LEVEL[g.level].maxLives)
    }
  }
}

/** A hit: lose a life, and end the run if it was the last one. */
function hurt(g) {
  g.lives--
  if (g.lives > 0) {
    g.ghost = true
    g.hurtAt = g.t
    g.vy = CFG.lift // a hop to recover
    if (hitsGround(g)) g.y = g.floor - CFG.birdR
    return
  }
  g.phase = 'over'
  g.overAt = g.t
  clampToGround(g)
}

/**
 * While a ghost the bird flies through pillars and hops off the ground. It
 * turns solid again once `ghostTime` is up and it's clear of every pillar.
 */
function ghostStep(g) {
  if (hitsGround(g)) { g.y = g.floor - CFG.birdR; g.vy = CFG.lift }
  if (g.t - g.hurtAt >= CFG.ghostTime && !hitsPillar(g)) g.ghost = false
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
  g.dist += dx
  for (const p of g.pillars) {
    p.x -= dx
    p.gapY = gapYAt(p, g.t)
    if (!p.passed && p.x + CFG.pillarW < CFG.birdX - CFG.birdR) {
      p.passed = true
      g.score++
      g.scoredAt = g.t
    }
  }
  g.pillars = g.pillars.filter(p => p.x + CFG.pillarW > DESPAWN_X)
  for (const d of g.drafts) d.x -= dx
  g.drafts = g.drafts.filter(d => d.x + CFG.draftW > DESPAWN_X)
  const last = g.pillars.at(-1)
  if (!last || last.x < SPAWN_X - CFG.spacing) spawn(g, rand)
}

/** Advance the game by dt seconds. Mutates and returns g. */
export function step(g, dt, rand = Math.random) {
  dt = Math.min(dt, 1 / 20) // don't tunnel through pillars after a stall
  g.t += dt

  if (g.phase === 'ready') {
    g.y = START_Y + Math.sin(g.t * 3) * 8
    g.scroll += CFG.speed * dt
    return g
  }

  // Gravity applies while playing and while the wreck falls after a crash.
  // An updraft is moving air: it carries the bird up on top of its own
  // flight, so flaps feel the same inside one.
  g.vy = Math.min(g.vy + CFG.gravity * dt, CFG.maxFall)
  g.y += g.vy * dt
  const draft = g.phase === 'playing' ? draftAt(g) : null
  g.inDraft = !!draft
  if (draft) g.y -= draftRise(draft) * dt
  clampToSky(g)

  if (g.phase === 'over') {
    clampToGround(g)
    return g
  }

  scrollPillars(g, dt, rand)
  collectTrinkets(g)
  if (g.ghost) ghostStep(g)
  else if (collides(g)) hurt(g)
  return g
}
