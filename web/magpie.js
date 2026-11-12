// The magpie sprite, drawn with canvas paths. Used by the game renderer and
// by drawIcon() for the home-screen icons.

/**
 * The magpie's colours: black with white belly and shoulder, blue-green sheen
 * on wing and tail, and a warm sunset rim light. Themes can pass their own.
 */
export const MAGPIE = Object.freeze({
  body: '#17161d',
  bodyFar: '#0f0e14', // far wing, in the body's shadow
  white: '#f7f2ea',
  beak: '#2b2a31',
  sheenWing: '#2f4f8f',
  sheenTail: '#2c6a6c',
  rim: 'rgba(255, 196, 150, 0.5)',
  cross: '#f7f2ea', // the crossed-out eye after a crash
})

/**
 * The magpie at (x, y), facing right, in a ~45px unit box times `scale`.
 * `tilt` rotates it (positive noses down), `wing` > 0 raises the wing tip,
 * `dead` crosses out the eye, and `colors` recolours it (see MAGPIE).
 */
export function paintMagpie(c, x, y, tilt, scale, wing, dead, colors = MAGPIE) {
  c.save()
  c.translate(x, y)
  c.rotate(tilt)
  c.scale(scale, scale)
  c.lineJoin = 'round'

  // short tail: the body ends at x = -14; the tail tip sits at -21
  c.fillStyle = colors.body
  c.beginPath()
  c.moveTo(-8, -2)
  c.lineTo(-18, -2)
  c.quadraticCurveTo(-24, 1.5, -18, 5)
  c.lineTo(-8, 5)
  c.closePath()
  c.fill()
  c.strokeStyle = colors.sheenTail
  c.lineWidth = 1.6
  c.beginPath()
  c.moveTo(-13, 1.5)
  c.lineTo(-19, 1.5)
  c.stroke()

  // far wing (behind body), mirrored and darker
  drawWing(c, -wing * 0.6, true, colors)

  // body
  c.fillStyle = colors.body
  c.beginPath()
  c.ellipse(0, 1, 14, 9, 0, 0, Math.PI * 2)
  c.fill()
  // white belly
  c.fillStyle = colors.white
  c.beginPath()
  c.ellipse(1, 5, 9, 4.5, -0.1, 0, Math.PI * 2)
  c.fill()

  // head
  c.fillStyle = colors.body
  c.beginPath()
  c.arc(12, -4, 7, 0, Math.PI * 2)
  c.fill()
  // beak
  c.fillStyle = colors.beak
  c.beginPath()
  c.moveTo(17.5, -6)
  c.lineTo(25, -3.5)
  c.lineTo(17.5, -1.5)
  c.closePath()
  c.fill()
  drawEye(c, dead, colors.cross)

  // sunset rim light along the back of the head
  c.strokeStyle = colors.rim
  c.lineWidth = 1.2
  c.beginPath()
  c.arc(12, -4, 6.6, -Math.PI * 0.8, -Math.PI * 0.35)
  c.stroke()

  // near wing (in front of body)
  drawWing(c, wing, false, colors)
  c.restore()
}

function drawEye(c, dead, cross) {
  if (dead) {
    c.strokeStyle = cross
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
function drawWing(c, angle, far, colors) {
  c.save()
  c.translate(2, -2)
  c.rotate(-angle)
  c.fillStyle = far ? colors.bodyFar : colors.body
  c.beginPath()
  c.moveTo(4, -1)
  c.quadraticCurveTo(-6, -9, -21, -4)
  c.lineTo(-17, 1)
  c.quadraticCurveTo(-6, 5, 4, 3)
  c.closePath()
  c.fill()
  if (!far) {
    // white shoulder patch and blue sheen on the flight feathers
    c.fillStyle = colors.white
    c.beginPath()
    c.ellipse(-3, 0, 6, 2.6, -0.15, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = colors.sheenWing
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(-10, -3.5)
    c.quadraticCurveTo(-15, -4.5, -19, -3)
    c.stroke()
  }
  c.restore()
}
