import type { GameEvent } from '../engine/types'
import type { Reaction } from './crowd'

/**
 * Every sound is synthesised from oscillators and noise — no files, nothing to
 * license, nothing to download. A sound is plain data so the bank can be read,
 * tuned and tested without an audio context.
 */
export interface Tone {
  /** Hz at the start of the tone. */
  freq: number
  /** Slide to this frequency across the tone, for risers and drops. */
  slideTo?: number
  startMs: number
  durationMs: number
  type: OscillatorType
  gain: number
}

export interface NoiseBurst {
  startMs: number
  durationMs: number
  gain: number
  /** Cutoff of the low-pass in front of it: lower is duller and heavier. */
  cutoff: number
}

export interface Sound {
  tones: Tone[]
  noise?: NoiseBurst[]
}

const tone = (
  freq: number,
  startMs: number,
  durationMs: number,
  gain: number,
  type: OscillatorType = 'sine',
  slideTo?: number,
): Tone => ({ freq, startMs, durationMs, gain, type, slideTo })

const BANK = {
  /** A tap that counted. */
  tap: { tones: [tone(680, 0, 45, 0.272, 'square')] },
  /** A tap on the wrong pad: audibly nothing happened. */
  dead: { tones: [tone(150, 0, 70, 0.17, 'square', 110)] },
  /** Committing to a card. */
  select: { tones: [tone(520, 0, 50, 0.238, 'triangle', 780)] },

  perfect: {
    tones: [
      tone(880, 0, 200, 0.34),
      tone(1320, 70, 200, 0.289),
      tone(1760, 140, 260, 0.238),
    ],
  },
  good: { tones: [tone(600, 0, 180, 0.306, 'sine', 760)] },
  miss: {
    tones: [tone(160, 0, 260, 0.34, 'sawtooth', 70)],
    noise: [{ startMs: 0, durationMs: 180, gain: 0.272, cutoff: 900 }],
  },
  /** A card burned to the floor. */
  fumble: {
    tones: [tone(320, 0, 420, 0.306, 'sawtooth', 80)],
    noise: [{ startMs: 60, durationMs: 300, gain: 0.17, cutoff: 600 }],
  },

  godAura: {
    tones: [
      tone(220, 0, 620, 0.272, 'sawtooth', 880),
      tone(440, 300, 700, 0.221),
      tone(554, 340, 700, 0.187),
      tone(660, 380, 700, 0.17),
    ],
  },
  godAuraLost: { tones: [tone(660, 0, 420, 0.272, 'sawtooth', 180)] },

  mogged: {
    tones: [tone(110, 0, 800, 0.408, 'square', 55), tone(220, 0, 500, 0.204)],
    noise: [{ startMs: 0, durationMs: 500, gain: 0.34, cutoff: 500 }],
  },
  /** The phone changing hands. */
  handoff: { tones: [tone(440, 0, 120, 0.221), tone(587, 110, 200, 0.221)] },
  /** One per second while the choosing clock is running out. */
  tick: { tones: [tone(1100, 0, 35, 0.17, 'square')] },
} satisfies Record<string, Sound>

export type SoundName = keyof typeof BANK

/**
 * `satisfies` above keeps the key names exact; this alias hands the values back
 * as plain Sounds, so reading `.noise` off one that has none is allowed.
 */
export const SOUNDS: Record<SoundName, Sound> = BANK

/** What a match event sounds like. Not every event makes a noise. */
export function soundFor(event: GameEvent): SoundName | null {
  switch (event.type) {
    case 'judgement':
      switch (event.result.judgement) {
        case 'PERFECT':
          return 'perfect'
        case 'GOOD':
          return 'good'
        case 'MISS':
          return 'miss'
        default:
          return 'fumble'
      }
    case 'godAura':
      return event.on ? 'godAura' : 'godAuraLost'
    case 'mogged':
      return 'mogged'
    case 'phase':
      return event.phase === 'handoff' ? 'handoff' : null
    default:
      return null
  }
}

/**
 * How the room takes it. Deliberately separate from `soundFor`: the effect is
 * the play landing, and this is a couple of hundred people having an opinion
 * about it a moment later.
 */
export function crowdFor(event: GameEvent): Reaction | null {
  switch (event.type) {
    case 'judgement':
      switch (event.result.judgement) {
        case 'PERFECT':
          return 'cheer'
        case 'GOOD':
          return 'applause'
        // A MISS and a frozen clock both get the same sag.
        default:
          return 'groan'
      }
    case 'godAura':
      return event.on ? 'roar' : 'groan'
    case 'mogged':
      return 'roar'
    default:
      return null
  }
}

/** How long a sound runs, so nothing is cut off early. */
export function soundLength(sound: Sound): number {
  const ends = [
    ...sound.tones.map((t) => t.startMs + t.durationMs),
    ...(sound.noise ?? []).map((n) => n.startMs + n.durationMs),
  ]
  return Math.max(0, ...ends)
}
