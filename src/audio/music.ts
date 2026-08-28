/**
 * The background loop, synthesised rather than sampled — same as every other
 * sound in the game, so it costs nothing to download and there is no licence
 * attached to it.
 *
 * Trap, roughly: a saturated 808 doing the melodic work down low, a clap on the
 * three, hats subdividing fast with rolls to fill the gaps, and a sparse bell
 * on top. Written at 140 with the backbeat on beat three, so it reads half-time
 * — heavy and unhurried rather than busy.
 */

const BPM = 140
const BEAT = 60 / BPM
/** The pattern is written on sixteenths; rolls subdivide inside a step. */
const STEP = BEAT / 4
const STEPS_PER_BAR = 16
const LOOP_STEPS = STEPS_PER_BAR * 4

interface Bar {
  /** MIDI note of the 808. It is the bassline and the chord at once. */
  root: number
  /** Sixteenths the 808 speaks on. The first one is always the heaviest. */
  bass: number[]
  /** Sparse bell on top: [sixteenth, MIDI note]. */
  bell: [step: number, note: number][]
}

/** i – i – VI – VII in A minor. Trap does not need more chords than this. */
const BARS: Bar[] = [
  { root: 45, bass: [0, 6, 10], bell: [[0, 69], [6, 76]] },
  { root: 45, bass: [0, 6, 11], bell: [[2, 76], [10, 72]] },
  { root: 41, bass: [0, 4, 10], bell: [[0, 77], [8, 72]] },
  { root: 43, bass: [0, 6, 10, 14], bell: [[2, 74], [10, 67]] },
]

/** Sixteenths that carry a hat roll, and how many hits to cram into one. */
const ROLLS: Record<number, number> = { 7: 3, 11: 2, 15: 4 }
/** The backbeat. One clap, on the three, is what makes it read half-time. */
const CLAP_STEP = 8

const BASE_GAIN = 0.19
/**
 * The lowpass on the whole loop. It was at 6200, which was below the highpass
 * on the hats: between them the two filters cancelled the hats out almost
 * completely — measured at 58 times quieter than the 808, which is silence in
 * practice, and the hats are the whole rhythm.
 */
const BASE_CUTOFF = 9500
/** Where the loop goes when somebody catches fire. */
const LIT_GAIN = 0.26
const LIT_CUTOFF = 14000

/**
 * How far ahead notes are queued, and how often the queue is topped up. Both
 * generous: a backgrounded tab throttles the timer to roughly a second, and a
 * horizon that does not clear that ran dry mid-bar and the loop fell apart.
 */
const HORIZON = 2.6
const TICK_MS = 500

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

let ctx: AudioContext | null = null
let bus: GainNode | null = null
let tone: BiquadFilterNode | null = null
let noise: AudioBuffer | null = null
let drive: WaveShaperNode | null = null
let timer = 0
let step = 0
let nextAt = 0
/** 0 normal, 1 while god aura is out. Read by the scheduler as it goes. */
let heat = 0

function noiseBuffer(context: AudioContext): AudioBuffer {
  if (noise) return noise
  const frames = Math.floor(context.sampleRate * 0.4)
  const buffer = context.createBuffer(1, frames, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  noise = buffer
  return buffer
}

/**
 * What separates an 808 from a sine wave: drive it until the peak folds over
 * and the fundamental picks up harmonics a phone speaker can actually move.
 *
 * Cached, but only for the context that built it: a node belongs to the
 * context that created it, and handing a stale one to a new context throws.
 */
function saturator(context: AudioContext): WaveShaperNode {
  if (drive && drive.context === context) return drive
  const shaper = context.createWaveShaper()
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * 2.6)
  }
  shaper.curve = curve
  shaper.oversample = '2x'
  drive = shaper
  return shaper
}

/** The 808: a sine that snaps down onto its note and rings out. */
function eightOhEight(note: number, at: number, seconds: number, gain: number): void {
  if (!ctx || !bus) return
  const target = freq(note)
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  // The click at the front is the pitch falling out of the sky onto the note.
  osc.frequency.setValueAtTime(target * 5, at)
  osc.frequency.exponentialRampToValueAtTime(target, at + 0.055)

  const envelope = ctx.createGain()
  envelope.gain.setValueAtTime(0.0001, at)
  envelope.gain.linearRampToValueAtTime(gain, at + 0.006)
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds)

  osc.connect(envelope).connect(saturator(ctx)).connect(bus)
  osc.start(at)
  osc.stop(at + seconds + 0.02)
}

/** Short noise through a band, for hats. */
function hat(at: number, gain: number, seconds: number): void {
  if (!ctx || !bus) return
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  source.playbackRate.value = 1.4

  const band = ctx.createBiquadFilter()
  band.type = 'highpass'
  // Below the bus lowpass, or the hat is filtered out of its own mix.
  band.frequency.value = 6800

  const envelope = ctx.createGain()
  envelope.gain.setValueAtTime(gain, at)
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds)

  source.connect(band).connect(envelope).connect(bus)
  source.start(at)
  source.stop(at + seconds + 0.02)
}

/** Three transients on top of each other, which is what a clap is. */
function clap(at: number, gain: number): void {
  if (!ctx || !bus) return
  for (const [offset, level] of [
    [0, 0.7],
    [0.011, 0.9],
    [0.023, 1],
  ] as const) {
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx)

    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1750
    band.Q.value = 1.1

    const envelope = ctx.createGain()
    const start = at + offset
    envelope.gain.setValueAtTime(gain * level, start)
    // The last hit carries the tail; the first two are just the slap.
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + (level === 1 ? 0.19 : 0.035))

    source.connect(band).connect(envelope).connect(bus)
    source.start(start)
    source.stop(start + 0.24)
  }
}

/** A short detuned pluck, high up where the 808 leaves room. */
function bell(note: number, at: number, gain: number): void {
  if (!ctx || !bus) return
  const seconds = BEAT * 0.7
  const shape = ctx.createGain()
  shape.gain.setValueAtTime(0.0001, at)
  shape.gain.linearRampToValueAtTime(gain, at + 0.012)
  shape.gain.exponentialRampToValueAtTime(0.0001, at + seconds)
  shape.connect(bus)

  // Two voices a few cents apart: one alone is a test tone.
  for (const cents of [-7, 7]) {
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq(note) * 2 ** (cents / 1200), at)
    osc.connect(shape)
    osc.start(at)
    osc.stop(at + seconds + 0.02)
  }
}

/** Lays down everything that happens on one sixteenth of the loop. */
function scheduleStep(index: number, at: number): void {
  const bar = BARS[Math.floor(index / STEPS_PER_BAR) % BARS.length]
  const inBar = index % STEPS_PER_BAR
  const lit = heat > 0

  if (bar.bass.includes(inBar)) {
    const heavy = inBar === 0
    eightOhEight(bar.root, at, heavy ? BEAT * 1.5 : BEAT * 0.8, heavy ? 0.38 : 0.24)
  }

  if (inBar === CLAP_STEP) clap(at, 0.26)

  // Straight sixteenths, with a roll wherever the pattern calls for one. On
  // fire, the whole line doubles up.
  const rolls = ROLLS[inBar] ?? (lit && inBar % 2 === 1 ? 2 : 1)
  for (let i = 0; i < rolls; i++) {
    hat(at + (STEP / rolls) * i, i === 0 ? 0.42 : 0.3, 0.032)
  }

  for (const [bellStep, note] of bar.bell) {
    if (bellStep !== inBar) continue
    bell(note, at, 0.15)
    // An octave up joins in once the fire is lit, so the loop lifts with it.
    if (lit) bell(note + 12, at, 0.075)
  }
}

function pump(): void {
  if (!ctx) return
  while (nextAt < ctx.currentTime + HORIZON) {
    scheduleStep(step, nextAt)
    nextAt += STEP
    step = (step + 1) % LOOP_STEPS
  }
}

/**
 * Starts the loop under `destination`. Safe to call again: a second call while
 * it is already running does nothing.
 */
export function startMusic(context: AudioContext, destination: AudioNode): void {
  if (timer) return

  ctx = context
  bus = context.createGain()
  bus.gain.value = BASE_GAIN

  // Rolled off at the top so the loop sits under the effects rather than
  // competing with them. Opening this filter is most of what "louder" means
  // when god aura lands.
  tone = context.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = BASE_CUTOFF
  bus.connect(tone).connect(destination)

  step = 0
  heat = 0
  nextAt = context.currentTime + 0.15
  pump()
  timer = window.setInterval(pump, TICK_MS)
}

/**
 * Lifts the loop while somebody is on fire: louder, brighter, hats doubled and
 * the bell an octave up. Ramped rather than switched, so it swells into it.
 */
export function setMusicHeat(lit: boolean): void {
  heat = lit ? 1 : 0
  if (!ctx || !bus || !tone) return
  const at = ctx.currentTime
  bus.gain.setTargetAtTime(lit ? LIT_GAIN : BASE_GAIN, at, 0.35)
  tone.frequency.setTargetAtTime(lit ? LIT_CUTOFF : BASE_CUTOFF, at, 0.35)
}

export function stopMusic(): void {
  if (timer) window.clearInterval(timer)
  timer = 0
  bus?.disconnect()
  tone?.disconnect()
  bus = null
  tone = null
  ctx = null
  drive = null
  noise = null
  heat = 0
}
