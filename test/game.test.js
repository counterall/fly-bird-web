import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CFG, GROUND, LEVEL, LEVELS, MEDALS, hasTrinket, trinketPos, START_Y, W, createGame, flap, step, hitsRect, gapFor, speedFor, isCalm, shiftFor, medalFor, nextMedal } from '../web/game.js'

const run = (g, secs, rand = () => 0.5) => { for (let i = 0; i < secs * 60; i++) step(g, 1 / 60, rand); return g }

test('ready phase hovers without falling', () => {
  const g = run(createGame(), 3)
  assert.equal(g.phase, 'ready')
  assert.ok(Math.abs(g.y - START_Y) <= 8)
  assert.equal(g.pillars.length, 0)
})

test('first flap starts the game and lifts the bird', () => {
  const g = flap(createGame())
  assert.equal(g.phase, 'playing')
  assert.equal(g.vy, CFG.lift)
})

test('without input the bird hits the ground', () => {
  const g = run(flap(createGame()), 3)
  assert.equal(g.phase, 'over')
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
  assert.equal(g.phase, 'playing')
  assert.ok(g.score >= 8, `score ${g.score}`)
})

test('hitting a pillar ends the run', () => {
  const g = flap(createGame())
  g.pillars.push({ x: CFG.birdX - 5, gapY: 100, gap: 120, passed: false })
  step(g, 1 / 60)
  assert.equal(g.phase, 'over')
})

test('restart only after the delay, via the title screen', () => {
  const g = run(flap(createGame()), 3)
  const t = g.t
  g.overAt = t
  assert.equal(flap(g), g)
  g.t = t + CFG.restartDelay + 0.01
  const n = flap(g)
  assert.notEqual(n, g)
  assert.equal(n.phase, 'ready') // back to the title screen…
  assert.equal(flap(n).phase, 'playing') // …and the next flap starts
  assert.equal(n.score, 0)
  assert.equal(n.level, 'easy')
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
  assert.equal(g.phase, 'over')
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
  assert.equal(g.phase, 'over')
  assert.equal(g.y, GROUND + 50 - CFG.birdR)
  // below GROUND but under a pillar still collides
  const h = flap(createGame())
  h.floor = GROUND + 50
  h.y = GROUND + 20
  h.pillars = [{ x: CFG.birdX - 5, gapY: 300, gap: 150, passed: false }]
  step(h, 1 / 60)
  assert.equal(h.phase, 'over')
})

test('consecutive gaps never move further than the allowed shift', () => {
  const g = flap(createGame())
  let prev = START_Y
  for (let n = 0; n < 200; n++) {
    // a lone pillar just far enough left to trigger the next spawn, clear of the bird
    g.pillars = [{ x: W + 10 - CFG.spacing - 1, gapY: prev, gap: CFG.gap, passed: true }]
    Object.assign(g, { spawned: n, score: n, y: 300, vy: 0, phase: 'playing' })
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

test('medals by score', () => {
  assert.equal(medalFor(9), null)
  assert.equal(medalFor(10).name, 'bronze')
  assert.equal(medalFor(49).name, 'silver')
  assert.equal(medalFor(500).name, 'gold')
  assert.equal(nextMedal(0).name, 'bronze')
  assert.equal(nextMedal(25).name, 'gold')
  assert.equal(nextMedal(50), null)
  assert.deepEqual(MEDALS.map(m => m.score), [10, 25, 50])
})

test('distance flown grows only while playing and records when points score', () => {
  const g = run(createGame(), 1)
  assert.equal(g.dist, 0)
  const h = flap(createGame())
  h.y = 300
  h.pillars = [{ x: CFG.birdX - CFG.birdR - CFG.pillarW + 1, gapY: 300, gap: 400, passed: false }]
  step(h, 1 / 60)
  assert.ok(h.dist > 0)
  assert.equal(h.scoredAt, h.t)
})

test('a game keeps its level across restarts', () => {
  assert.deepEqual(LEVELS, ['easy', 'hard'])
  assert.equal(createGame().level, 'easy')
  const g = run(flap(createGame('hard')), 3)
  g.t += CFG.restartDelay
  assert.equal(flap(g).level, 'hard')
})

// A pillar right at the bird, with the gap far away: flying on means a hit.
const wall = () => ({ x: CFG.birdX - 5, gapY: 100, gap: 120, passed: false, trinket: null })

test('easy: trinkets ride on every 7th pillar from the 4th, while a life can be gained', () => {
  const g = createGame('easy')
  const on = [...Array(30).keys()].filter(n => hasTrinket(g, n))
  assert.deepEqual(on, [4, 11, 18, 25])
  g.lives = LEVEL.easy.maxLives
  assert.equal(hasTrinket(g, 4), false)
  assert.equal(hasTrinket(createGame('hard'), 4), false)
})

test('spawned pillars carry their trinket', () => {
  const g = flap(createGame('easy'))
  for (let i = 0; i < 60 * 12 && g.spawned < 6; i++) { g.y = 300; g.vy = 0; g.pillars.forEach(p => { p.gapY = 300; p.gap = 400 }); step(g, 1 / 60, () => 0.5) }
  const p = g.pillars.find(q => q.trinket)
  assert.ok(p, 'a pillar with a trinket')
  assert.equal(g.pillars.filter(q => q.trinket).length, 1)
})

test('collecting a trinket gives a life, up to the maximum', () => {
  const g = flap(createGame('easy'))
  const p = { x: CFG.birdX - CFG.pillarW / 2, gapY: 300, gap: 400, passed: false, trinket: { side: 1, takenAt: -1 } }
  g.pillars = [p]
  g.y = trinketPos(p).y
  g.vy = 0
  step(g, 1 / 60)
  assert.equal(g.lives, 2)
  assert.ok(p.trinket.takenAt > 0)
  step(g, 1 / 60) // already taken: no more
  assert.equal(g.lives, 2)
  g.lives = LEVEL.easy.maxLives
  g.pillars = [{ ...p, x: CFG.birdX - CFG.pillarW / 2, trinket: { side: 1, takenAt: -1 } }]
  g.y = trinketPos(g.pillars[0]).y
  step(g, 1 / 60)
  assert.equal(g.lives, LEVEL.easy.maxLives)
})

test('a hit with lives to spare costs one and lets the bird fly through for a while', () => {
  const g = flap(createGame('easy'))
  g.lives = 2
  g.y = 300
  g.pillars = [wall()]
  step(g, 1 / 60)
  assert.equal(g.phase, 'playing')
  assert.equal(g.lives, 1)
  assert.ok(g.ghost)
  assert.equal(g.vy, CFG.lift)
  // still inside the pillar after ghostTime: stays a ghost until it's clear
  for (let i = 0; i < 60 * CFG.ghostTime + 5; i++) { g.pillars[0].x = CFG.birdX - 5; g.y = 300; step(g, 1 / 60) }
  assert.ok(g.ghost)
  assert.equal(g.lives, 1)
  g.pillars = []
  step(g, 1 / 60)
  assert.equal(g.ghost, false)
  // solid again: the next hit is the last
  g.pillars = [wall()]
  step(g, 1 / 60)
  assert.equal(g.phase, 'over')
  assert.equal(g.lives, 0)
})

test('a ghost hops off the ground instead of crashing', () => {
  const g = flap(createGame('easy'))
  g.lives = 2
  g.y = GROUND - CFG.birdR + 1
  g.vy = 300
  step(g, 1 / 60)
  assert.equal(g.lives, 1)
  for (let i = 0; i < 60; i++) { g.pillars = []; step(g, 1 / 60) }
  assert.equal(g.phase, 'playing')
  assert.ok(g.y < GROUND - CFG.birdR)
})

test('hard: one life, so the first hit ends the run', () => {
  const g = flap(createGame('hard'))
  assert.equal(g.lives, 1)
  g.pillars = [wall()]
  step(g, 1 / 60)
  assert.equal(g.phase, 'over')
})
