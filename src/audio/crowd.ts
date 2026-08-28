/**
 * A room full of people, synthesised. Applause is not one sound — it is a few
 * dozen short transients scattered close together under a wash of noise, and
 * scattering them by hand is what stops it reading as static.
 *
 * Every reaction is randomised on the spot, so the same PERFECT twice running
 * never sounds like a recording being replayed.
 */

export type Reaction = 'applause' | 'cheer' | 'roar' | 'groan'

interface Shape {
  /** How many individual pairs of hands. */
  claps: number
  /** How long they are spread over. */
  spreadMs: number
  clapGain: number
  /** The body of the room underneath the claps. */
  washGain: number
  washCutoff: number
  washMs: number
  /** Voices, sliding. Up is a cheer, down is a groan. */
  voices?: { count: number; from: number; to: number; gain: number; ms: number }
}

const SHAPES: Record<Reaction, Shape> = {
  // A polite ripple: enough to know they noticed.
  applause: { claps: 18, spreadMs: 620, clapGain: 0.15, washGain: 0.07, washCutoff: 2600, washMs: 700 },
  cheer: {
    claps: 30,
    spreadMs: 900,
    clapGain: 0.13,
    washGain: 0.09,
    washCutoff: 3200,
    washMs: 1000,
    voices: { count: 3, from: 60, to: 71, gain: 0.045, ms: 620 },
  },
  roar: {
    claps: 48,
    spreadMs: 1400,
    clapGain: 0.15,
    washGain: 0.13,
    washCutoff: 3600,
    washMs: 1700,
    voices: { count: 5, from: 57, to: 74, gain: 0.06, ms: 1100 },
  },
  // Nobody claps. The room just sags.
  groan: {
    claps: 0,
    spreadMs: 0,
    clapGain: 0,
    washGain: 0.07,
    washCutoff: 900,
    washMs: 900,
    voices: { count: 4, from: 55, to: 47, gain: 0.05, ms: 850 },
  },
}

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

let noise: AudioBuffer | null = null

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise
  const frames = Math.floor(ctx.sampleRate * 0.5)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  noise = buffer
  return buffer
}

/** One pair of hands: a very short band of noise. */
function oneClap(ctx: AudioContext, out: AudioNode, at: number, gain: number): void {
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  // A different slice of the buffer each time, or they all sound identical.
  source.playbackRate.value = 0.85 + Math.random() * 0.5

  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1200 + Math.random() * 2200
  band.Q.value = 0.9

  const envelope = ctx.createGain()
  const seconds = 0.012 + Math.random() * 0.022
  envelope.gain.setValueAtTime(gain * (0.5 + Math.random() * 0.9), at)
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds)

  source.connect(band).connect(envelope).connect(out)
  source.start(at)
  source.stop(at + seconds + 0.02)
}

/**
 * Plays a reaction into `destination`. A no-op is fine when there is no
 * context yet: the room is not the game.
 */
export function playCrowd(ctx: AudioContext, destination: AudioNode, reaction: Reaction): void {
  const shape = SHAPES[reaction]
  const now = ctx.currentTime

  // Claps bunch up early and thin out, the way a real room does.
  for (let i = 0; i < shape.claps; i++) {
    const bias = Math.random() ** 1.7
    oneClap(ctx, destination, now + 0.02 + bias * (shape.spreadMs / 1000), shape.clapGain)
  }

  const wash = ctx.createBufferSource()
  wash.buffer = noiseBuffer(ctx)
  wash.loop = true

  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = shape.washCutoff
  band.Q.value = 0.6

  const swell = ctx.createGain()
  const washEnd = now + shape.washMs / 1000
  swell.gain.setValueAtTime(0.0001, now)
  swell.gain.linearRampToValueAtTime(shape.washGain, now + shape.washMs / 4000)
  swell.gain.exponentialRampToValueAtTime(0.0001, washEnd)

  wash.connect(band).connect(swell).connect(destination)
  wash.start(now)
  wash.stop(washEnd + 0.05)

  if (!shape.voices) return
  for (let i = 0; i < shape.voices.count; i++) {
    const { from, to, gain, ms } = shape.voices
    // Each voice starts a little late and a little off, like actual people.
    const start = now + Math.random() * 0.14
    const end = start + (ms / 1000) * (0.8 + Math.random() * 0.4)
    const detune = (Math.random() - 0.5) * 2.4

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(freq(from + detune), start)
    osc.frequency.exponentialRampToValueAtTime(freq(to + detune), end)

    // Voices are not sawtooths; most of what makes them one has to come off.
    const throat = ctx.createBiquadFilter()
    throat.type = 'lowpass'
    throat.frequency.value = 1100
    throat.Q.value = 3

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.linearRampToValueAtTime(gain, start + (end - start) * 0.35)
    envelope.gain.exponentialRampToValueAtTime(0.0001, end)

    osc.connect(throat).connect(envelope).connect(destination)
    osc.start(start)
    osc.stop(end + 0.02)
  }
}
