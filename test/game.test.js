import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CFG, GROUND, createGame, flap, step, hitsRect, gapFor } from '../web/game.js'

const run = (g, secs, rand = () => 0.5) => { for (let i = 0; i < secs * 60; i++) step(g, 1 / 60, rand); return g }

test('ready mode hovers without falling', () => {
  const g = run(createGame(), 3)
  assert.equal(g.mode, 'ready')
  assert.ok(g.y > 200 && g.y < 300)
})

test('first flap starts the game and lifts the plane', () => {
  const g = flap(createGame())
  assert.equal(g.mode, 'playing')
  assert.equal(g.vy, CFG.lift)
})

test('without input the plane hits the ground', () => {
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
