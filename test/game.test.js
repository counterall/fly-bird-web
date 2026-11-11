import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CFG, GROUND, START_Y, W, createGame, flap, step, hitsRect, gapFor, speedFor, isCalm, shiftFor } from '../web/game.js'

const run = (g, secs, rand = () => 0.5) => { for (let i = 0; i < secs * 60; i++) step(g, 1 / 60, rand); return g }

test('ready mode hovers without falling', () => {
  const g = run(createGame(), 3)
  assert.equal(g.mode, 'ready')
  assert.ok(Math.abs(g.y - START_Y) <= 8)
  assert.equal(g.pillars.length, 0)
})

test('first flap starts the game and lifts the bird', () => {
  const g = flap(createGame())
  assert.equal(g.mode, 'playing')
  assert.equal(g.vy, CFG.lift)
})

test('without input the bird hits the ground', () => {
  const g = run(flap(createGame()), 3)
  assert.equal(g.mode, 'over')
  assert.equal(g.y, GROUND - CFG.birdR)
})

test('flying through gaps scores points', () => {
  // gaps always centred (rand = 0.5); flap whenever below the gap centre
  let g = flap(createGame())
  for (let i = 0; i < 60 * 20; i++) {
    const next = g.pillars.find(p => p.x + CFG.pillarW > CFG.birdX - CFG.birdR)
    const target = next ? next.gapY + 10 : 300
    if (g.y > target && g.vy > 0) g = flap(g)
    step(g, 1 / 60, () => 0.5)
  }
  assert.equal(g.mode, 'playing')
  assert.ok(g.score >= 8, `score ${g.score}`)
})

test('hitting a pillar ends the run', () => {
  const g = flap(createGame())
  g.pillars.push({ x: CFG.birdX - 5, gapY: 100, gap: 120, passed: false })
  step(g, 1 / 60)
  assert.equal(g.mode, 'over')
})

test('restart only after the delay', () => {
  const g = run(flap(createGame()), 3)
  const t = g.t
  g.overAt = t
  assert.equal(flap(g), g)
  g.t = t + CFG.restartDelay + 0.01
  const n = flap(g)
  assert.notEqual(n, g)
  assert.equal(n.mode, 'playing')
  assert.equal(n.score, 0)
})

test('gap shrinks with score but not below the minimum', () => {
  assert.equal(gapFor(0), CFG.gap)
  assert.equal(gapFor(1000), CFG.gapMin)
})

test('speed ramps up with score but is capped', () => {
  assert.equal(speedFor(0), CFG.speed)
  assert.equal(speedFor(4), CFG.speed + 4 * CFG.speedPerPoint)
  assert.equal(speedFor(1000), CFG.speed + CFG.speedCap)
})

test('each pillar scores once, after the bird is fully past it', () => {
  const g = flap(createGame())
  g.y = 300
  g.pillars = [{ x: CFG.birdX - CFG.birdR - CFG.pillarW + 1, gapY: 300, gap: 400, passed: false }]
  step(g, 1 / 60)
  assert.equal(g.score, 1)
  step(g, 1 / 60)
  assert.equal(g.score, 1)
})

test('the bird can\'t fly above the top of the sky', () => {
  const g = flap(createGame())
  g.y = CFG.birdR + 1
  g.vy = -2000
  step(g, 1 / 60)
  assert.equal(g.y, g.ceil + CFG.birdR)
  assert.equal(g.vy, 0)
})

test('a wreck that crashes into a pillar falls to the ground', () => {
  const g = flap(createGame())
  g.pillars.push({ x: CFG.birdX - 5, gapY: 400, gap: 120, passed: false })
  step(g, 1 / 60)
  assert.equal(g.mode, 'over')
  run(g, 3)
  assert.equal(g.y, GROUND - CFG.birdR)
})

test('circle/rect collision', () => {
  assert.ok(hitsRect(0, 0, 5, 3, -1, 10, 2))
  assert.ok(!hitsRect(0, 0, 5, 6, 0, 10, 10))
})

test('a lower floor (tall screens) moves the ground line and extends pillars to it', () => {
  const g = flap(createGame())
  g.floor = GROUND + 50
  for (let i = 0; i < 60 * 3; i++) { g.pillars = []; step(g, 1 / 60, () => 0.5) }
  assert.equal(g.mode, 'over')
  assert.equal(g.y, GROUND + 50 - CFG.birdR)
  // below GROUND but under a pillar still collides
  const h = flap(createGame())
  h.floor = GROUND + 50
  h.y = GROUND + 20
  h.pillars = [{ x: CFG.birdX - 5, gapY: 300, gap: 150, passed: false }]
  step(h, 1 / 60)
  assert.equal(h.mode, 'over')
})

test('consecutive gaps never move further than the allowed shift', () => {
  const g = flap(createGame())
  let prev = START_Y
  for (let n = 0; n < 200; n++) {
    // a lone pillar just far enough left to trigger the next spawn, clear of the bird
    g.pillars = [{ x: W + 10 - CFG.spacing - 1, gapY: prev, gap: CFG.gap, passed: true }]
    Object.assign(g, { spawned: n, score: n, y: 300, vy: 0, mode: 'playing' })
    step(g, 1 / 60, () => (n % 2 ? 0 : 0.999)) // swing to opposite extremes
    const p = g.pillars.at(-1)
    assert.equal(g.pillars.length, 2)
    assert.ok(Math.abs(p.gapY - prev) <= shiftFor(n, n) + 1e-9, `pillar ${n}: ${prev} -> ${p.gapY}`)
    assert.ok(p.gapY - p.gap / 2 >= CFG.edge - 1e-9, 'gap below the top edge')
    assert.ok(p.gapY + p.gap / 2 <= GROUND - CFG.edge + 1e-9, 'gap above the ground edge')
    prev = p.gapY
  }
})

test('calm stretches follow every tenth pillar', () => {
  assert.deepEqual([...Array(25).keys()].filter(isCalm), [10, 11, 12, 20, 21, 22])
  assert.equal(shiftFor(10, 30), CFG.calmShift)
  assert.equal(shiftFor(9, 0), CFG.shift)
  assert.ok(shiftFor(9, 30) > shiftFor(9, 0))
})
