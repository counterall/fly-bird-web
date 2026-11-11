// The magpie sprite, drawn with canvas paths. Used by the game renderer and
// by drawIcon() for the home-screen icons.

// Black with white belly and shoulder, blue-green sheen on wing and tail.
const BLACK = '#17161d'
const BLACK_FAR = '#0f0e14' // far wing, in the body's shadow
const WHITE = '#f7f2ea'
const BEAK = '#2b2a31'
const SHEEN_WING = '#2f4f8f'
const SHEEN_TAIL = '#2c6a6c'
const RIM = 'rgba(255, 196, 150, 0.5)' // warm sunset rim light

/**
 * The magpie at (x, y), facing right, in a ~45px unit box times `scale`.
 * `tilt` rotates it (positive noses down), `wing` > 0 raises the wing tip,
 * and `dead` crosses out the eye.
 */
export function paintMagpie(c, x, y, tilt, scale, wing, dead) {
  c.save()
  c.translate(x, y)
  c.rotate(tilt)
  c.scale(scale, scale)
  c.lineJoin = 'round'

  // short tail: the body ends at x = -14; the tail tip sits at -21
  c.fillStyle = BLACK
  c.beginPath()
  c.moveTo(-8, -2)
  c.lineTo(-18, -2)
  c.quadraticCurveTo(-24, 1.5, -18, 5)
  c.lineTo(-8, 5)
  c.closePath()
  c.fill()
  c.strokeStyle = SHEEN_TAIL
  c.lineWidth = 1.6
  c.beginPath()
  c.moveTo(-13, 1.5)
  c.lineTo(-19, 1.5)
  c.stroke()

  // far wing (behind body), mirrored and darker
  drawWing(c, -wing * 0.6, true)

  // body
  c.fillStyle = BLACK
  c.beginPath()
  c.ellipse(0, 1, 14, 9, 0, 0, Math.PI * 2)
  c.fill()
  // white belly
  c.fillStyle = WHITE
  c.beginPath()
  c.ellipse(1, 5, 9, 4.5, -0.1, 0, Math.PI * 2)
  c.fill()

  // head
  c.fillStyle = BLACK
  c.beginPath()
  c.arc(12, -4, 7, 0, Math.PI * 2)
  c.fill()
  // beak
  c.fillStyle = BEAK
  c.beginPath()
  c.moveTo(17.5, -6)
  c.lineTo(25, -3.5)
  c.lineTo(17.5, -1.5)
  c.closePath()
  c.fill()
  drawEye(c, dead)

  // sunset rim light along the back of the head
  c.strokeStyle = RIM
  c.lineWidth = 1.2
  c.beginPath()
  c.arc(12, -4, 6.6, -Math.PI * 0.8, -Math.PI * 0.35)
  c.stroke()

  // near wing (in front of body)
  drawWing(c, wing, false)
  c.restore()
}

function drawEye(c, dead) {
  if (dead) {
    c.strokeStyle = WHITE
    c.lineWidth = 1.3
    c.beginPath()
    c.moveTo(12.5, -7.5); c.lineTo(15.5, -4.5)
    c.moveTo(15.5, -7.5); c.lineTo(12.5, -4.5)
    c.stroke()
    return
  }
  c.fillStyle = '#fff'
  c.beginPath()
  c.arc(14, -6, 1.9, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#0b0a0f'
  c.beginPath()
  c.arc(14.5, -6, 1.1, 0, Math.PI * 2)
  c.fill()
}

/** Wing pivots at the shoulder and points backwards. */
function drawWing(c, angle, far) {
  c.save()
  c.translate(2, -2)
  c.rotate(-angle)
  c.fillStyle = far ? BLACK_FAR : BLACK
  c.beginPath()
  c.moveTo(4, -1)
  c.quadraticCurveTo(-6, -9, -21, -4)
  c.lineTo(-17, 1)
  c.quadraticCurveTo(-6, 5, 4, 3)
  c.closePath()
  c.fill()
  if (!far) {
    // white shoulder patch and blue sheen on the flight feathers
    c.fillStyle = WHITE
    c.beginPath()
    c.ellipse(-3, 0, 6, 2.6, -0.15, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = SHEEN_WING
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(-10, -3.5)
    c.quadraticCurveTo(-15, -4.5, -19, -3)
    c.stroke()
  }
  c.restore()
}
