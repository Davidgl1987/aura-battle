import { describe, expect, it } from 'vitest'
import { CARDS } from '../engine/cards'
import { CHARACTERS } from '../engine/characters'
import { BUILDS, getBuild, shoulderHeight } from './builds'
import {
  MOVES,
  finalePose,
  flourish,
  idlePose,
  moveAt,
  moveFor,
  reactPose,
  watchPose,
  windUpPose,
} from './animations'
import { NEUTRAL, blend, hold, type Pose } from './pose'

const ANGLES: (keyof Pose)[] = [
  'turn',
  'lean',
  'tilt',
  'headPitch',
  'headYaw',
  'armRaiseL',
  'armRaiseR',
  'armSwingL',
  'armSwingR',
  'elbowL',
  'elbowR',
  'legL',
  'legR',
]

/** A pose nobody would have to apologise for. */
function expectSane(p: Pose, where: string) {
  for (const key of ANGLES) {
    expect(Number.isFinite(p[key]), `${where}.${key}`).toBe(true)
    expect(Math.abs(p[key]), `${where}.${key}`).toBeLessThanOrEqual(Math.PI * 1.1)
  }
  expect(p.squash, `${where}.squash`).toBeGreaterThan(0.6)
  expect(p.squash, `${where}.squash`).toBeLessThan(1.4)
  expect(p.y, `${where}.y`).toBeGreaterThanOrEqual(-0.4)
  expect(p.y, `${where}.y`).toBeLessThanOrEqual(1)
}

const samples = Array.from({ length: 41 }, (_, i) => i / 40)

describe('every card has a body to go with it', () => {
  it('covers all ten animation keys', () => {
    for (const card of CARDS) {
      expect(MOVES[card.animation], `${card.name} → ${card.animation}`).toBeDefined()
    }
  })

  it('falls back to something harmless for an unknown key', () => {
    expect(moveFor('nope')).toBe(MOVES.tpose)
  })

  it('never twists a fighter into a shape it cannot hold', () => {
    for (const [name, move] of Object.entries(MOVES)) {
      for (const p of samples) expectSane(move(p), `${name}@${p}`)
    }
  })

  it('rises out of standing and returns to it', () => {
    const drift = (p: Pose) => ANGLES.reduce((sum, k) => sum + Math.abs(p[k] - NEUTRAL[k]), 0)
    for (const name of Object.keys(MOVES)) {
      expect(drift(moveAt(name, 0)), `${name} enters`).toBeLessThan(0.05)
      expect(drift(moveAt(name, 1)), `${name} exits`).toBeLessThan(0.05)
    }
  })

  it('actually moves — a card is not a statue', () => {
    for (const name of Object.keys(MOVES)) {
      const travel = Math.max(...samples.map((p) => ANGLES.reduce(
        (sum, k) => sum + Math.abs(moveAt(name, p)[k] - NEUTRAL[k]), 0)))
      expect(travel, `${name} goes somewhere`).toBeGreaterThan(1.5)
    }
  })

  it('keeps the performed version inside the same bounds', () => {
    for (const name of Object.keys(MOVES)) {
      for (const p of samples) expectSane(moveAt(name, p), `performed ${name}@${p}`)
    }
  })
})

describe('idling', () => {
  it('breathes without wandering off', () => {
    for (const character of CHARACTERS) {
      const build = getBuild(character.id)
      for (let s = 0; s < 12; s += 0.1) expectSane(idlePose(s, build), `${character.id}@${s}`)
    }
  })

  it('bounces more for a bouncy build than a heavy one', () => {
    const range = (id: string) => {
      const build = getBuild(id)
      const ys = samples.map((p) => idlePose(p * 6, build).y)
      return Math.max(...ys) - Math.min(...ys)
    }
    expect(range('orb')).toBeGreaterThan(range('chad'))
  })
})

describe('reacting to the judgement', () => {
  const results = ['PERFECT', 'GOOD', 'MISS', 'LOST_COMPOSURE'] as const

  it('has something to say about every result', () => {
    for (const judgement of results) {
      for (const p of samples) expectSane(reactPose(judgement, p), `${judgement}@${p}`)
    }
  })

  it('celebrates upward and takes a MISS downward', () => {
    const peak = (j: (typeof results)[number]) => Math.max(...samples.map((p) => reactPose(j, p).y))
    expect(peak('PERFECT')).toBeGreaterThan(0.3)
    expect(peak('MISS')).toBeLessThan(0.1)
    expect(Math.max(...samples.map((p) => reactPose('MISS', p).headPitch))).toBeGreaterThan(0.2)
  })

  it('gives the rival an answer to every result, and a different one', () => {
    for (const judgement of results) {
      for (const p of samples) expectSane(watchPose(judgement, p), `watching ${judgement}@${p}`)
    }
    // Shrinking away from a PERFECT is the opposite of leaning in over a MISS.
    const away = watchPose('PERFECT', 0.5).lean
    const closer = watchPose('MISS', 0.5).lean
    expect(away).toBeLessThan(0)
    expect(closer).toBeGreaterThan(0)
  })

  it('shrinks a fighter who froze', () => {
    const smallest = Math.min(...samples.map((p) => reactPose('LOST_COMPOSURE', p).squash))
    expect(smallest).toBeLessThan(0.9)
  })
})

describe('how the battle ends', () => {
  const overSeconds = Array.from({ length: 60 }, (_, i) => i * 0.1)

  it('holds both fighters together for as long as the screen is up', () => {
    for (const seconds of overSeconds) {
      expectSane(finalePose(true, seconds), `winner@${seconds}`)
      expectSane(finalePose(false, seconds), `loser@${seconds}`)
    }
  })

  it('sends the winner up and folds the loser over', () => {
    const highest = Math.max(...overSeconds.map((t) => finalePose(true, t).y))
    expect(highest).toBeGreaterThan(0.25)
    expect(Math.max(...overSeconds.map((t) => finalePose(true, t).armRaiseL))).toBeGreaterThan(2)

    const folded = Math.min(...overSeconds.map((t) => finalePose(false, t).lean))
    expect(folded).toBeGreaterThan(0.3)
    expect(Math.min(...overSeconds.map((t) => finalePose(false, t).headPitch))).toBeGreaterThan(0.4)
  })

  it('keeps moving, so neither of them is a freeze frame', () => {
    const spread = (won: boolean, key: 'y' | 'lean') => {
      const values = overSeconds.map((t) => finalePose(won, t)[key])
      return Math.max(...values) - Math.min(...values)
    }
    expect(spread(true, 'y')).toBeGreaterThan(0.2)
    expect(spread(false, 'lean')).toBeGreaterThan(0.02)
  })
})

describe('build flavour', () => {
  it('gives every character something to be assembled from', () => {
    for (const character of CHARACTERS) expect(() => getBuild(character.id)).not.toThrow()
    expect(Object.keys(BUILDS).sort()).toEqual(CHARACTERS.map((c) => c.id).sort())
  })

  it('matches the silhouettes the characters promise', () => {
    // "wide box torso, stubby limbs" vs "tall and thin, floppy"
    expect(BUILDS.blocky.torso[0]).toBeGreaterThan(BUILDS.noodle.torso[0])
    expect(BUILDS.noodle.armLength).toBeGreaterThan(BUILDS.blocky.armLength)
    expect(BUILDS.noodle.floppy).toBeGreaterThan(BUILDS.chad.floppy)
    // "huge shoulders, small head"
    expect(BUILDS.chad.shoulder).toBeGreaterThan(BUILDS.orb.shoulder)
    expect(BUILDS.chad.headSize).toBeLessThan(BUILDS.orb.headSize)
    // "bouncy squash and stretch"
    expect(BUILDS.orb.rubber).toBeGreaterThan(BUILDS.chad.rubber)
  })

  it('puts the shoulders above the ground for everyone', () => {
    for (const id of Object.keys(BUILDS)) {
      expect(shoulderHeight(BUILDS[id])).toBeGreaterThan(0.5)
    }
  })

  it('keeps a flourish inside the same bounds as the move', () => {
    for (const [name, move] of Object.entries(MOVES)) {
      for (const p of samples) {
        expectSane(flourish(move(p), BUILDS.noodle, p), `floppy ${name}@${p}`)
      }
    }
  })
})

describe('getting into and out of a move', () => {
  it('winds up by dipping, not by leaping', () => {
    const lowest = Math.min(...samples.map((p) => windUpPose(p).y))
    expect(lowest).toBeLessThan(0)
    // Begins and ends on the ground, whatever the floating point says.
    expect(windUpPose(0).y).toBeCloseTo(0)
    expect(windUpPose(1).y).toBeCloseTo(0)
  })

  it('blends the whole body, not just the first field', () => {
    const mixed = blend(NEUTRAL, MOVES.tpose(1), 0.5)
    expect(mixed.armRaiseL).toBeCloseTo((NEUTRAL.armRaiseL + MOVES.tpose(1).armRaiseL) / 2)
    expect(mixed.squash).toBeCloseTo((NEUTRAL.squash + MOVES.tpose(1).squash) / 2)
  })

  it('holds a held pose through the middle of the card', () => {
    expect(hold(0.5)).toBe(1)
    expect(hold(0)).toBe(0)
    expect(hold(1)).toBe(0)
  })
})
