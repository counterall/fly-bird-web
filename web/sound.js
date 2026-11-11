// Sound effects, synthesised with WebAudio: no audio files to load.
// Browsers only start audio after a user gesture, so main.js calls unlock()
// from its input handlers; sounds played before that are silently dropped.

/** Returns { muted, unlock(), toggle(), play(name) }. */
export function createSound(muted = false) {
  let ctx = null
  let out = null
  let noise = null

  function unlock() {
    if (!ctx) {
      const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext
      if (!AC) return
      ctx = new AC()
      out = ctx.createGain()
      out.gain.value = 0.6
      out.connect(ctx.destination)
      // half a second of white noise, reused for the whooshes and the thud
      noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate)
      const d = noise.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    if (ctx.state === 'suspended') ctx.resume()
  }

  /** A gain node with a quick attack and an exponential decay over `dur`. */
  function envelope(at, dur, vol) {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    g.connect(out)
    return g
  }

  /** An oscillator gliding from f0 to f1 Hz. */
  function tone(type, f0, f1, at, dur, vol) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, at)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + dur)
    o.connect(envelope(at, dur, vol))
    o.start(at)
    o.stop(at + dur + 0.02)
  }

  /** Filtered noise whose filter sweeps from f0 to f1 Hz. */
  function hiss(type, f0, f1, q, at, dur, vol) {
    const s = ctx.createBufferSource()
    s.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.Q.value = q
    f.frequency.setValueAtTime(f0, at)
    f.frequency.exponentialRampToValueAtTime(f1, at + dur)
    s.connect(f).connect(envelope(at, dur, vol))
    s.start(at)
    s.stop(at + dur + 0.02)
  }

  const SOUNDS = {
    // a wing beat: a short downward whoosh
    flap: t => hiss('bandpass', 1400, 500, 1.2, t, 0.13, 0.35),
    // a soft two-note chime
    score: t => {
      tone('triangle', 1046.5, 1046.5, t, 0.16, 0.16)
      tone('triangle', 1568, 1568, t + 0.06, 0.2, 0.12)
    },
    // a rising arpeggio when a run earns a medal
    medal: t => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone('triangle', f, f, t + i * 0.08, 0.28, 0.16)),
    // a bright, quick sparkle for a trinket
    trinket: t => [1318.5, 1760, 2093].forEach((f, i) => tone('triangle', f, f, t + i * 0.05, 0.18, 0.12)),
    // a lighter knock when a hit costs a life but the run goes on
    hurt: t => {
      tone('sine', 260, 110, t, 0.22, 0.35)
      hiss('lowpass', 1200, 300, 0.7, t, 0.15, 0.2)
    },
    // a dull thud
    crash: t => {
      tone('sine', 180, 45, t, 0.35, 0.5)
      hiss('lowpass', 900, 120, 0.7, t, 0.25, 0.35)
    },
  }

  return {
    get muted() { return muted },
    unlock,
    toggle() { muted = !muted; return muted },
    play(name) {
      if (muted || ctx?.state !== 'running') return
      SOUNDS[name](ctx.currentTime)
    },
  }
}
