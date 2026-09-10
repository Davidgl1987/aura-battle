import { describe, expect, it } from 'vitest'
import { CARDS, getCard } from '../engine/cards'
import { CHARACTERS } from '../engine/characters'
import { BUILDS, getBuild, shoulderHeight } from './builds'
import {
  DEALT_CLIPS,
  MOVES,
  REST_CLIP,
  STATE_CLIPS,
  USED_CLIPS,
  animationFor,
  clipForAction,
  finalePose,
  flourish,
  idlePose,
  moveAt,
  moveFor,
  reactPose,
  watchPose,
  windUpPose,
} from './animations'
import { ALL_CLIPS } from './clips'
import { NEUTRAL, blend, hold, type Pose } from './pose'
import type { Beat, FighterAction } from './stageState'

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
  it('names either a pose or an imported clip, for every card', () => {
    for (const card of CARDS) {
      const source = animationFor(card.animation)
      const named =
        source.type === 'clip' ? source.clip.id : Object.keys(MOVES).find((k) => MOVES[k] === source.move)
      expect(named, `${card.name} → ${card.animation}`).toBe(card.animation)
    }
  })

  /**
   * The registry holds every clip that has been downloaded and stood up in the
   * lab, including the ones that walk a metre off their mark on the way — they
   * are registered so they can be looked at, and this is what stops one being
   * chosen for a card before somebody has re-exported it with In Place on.
   */
  it('never asks a card to perform a clip that walks off its mark', () => {
    for (const card of CARDS) {
      const source = animationFor(card.animation)
      if (source.type === 'clip') {
        expect(source.clip.rootMotion, `${card.name} → ${source.clip.id}`).toBe('inPlace')
      }
    }
  })

  /**
   * The whole deck is imported motion now. It was one card and sixteen pose
   * functions, and the pose system is still what shows underneath — during a
   * blend, and on a clone that has not downloaded the clips — so this is the
   * line that would notice a card quietly falling back to it for good.
   */
  it('performs every card with an imported clip', () => {
    for (const card of CARDS) {
      expect(animationFor(card.animation).type, `${card.name} → ${card.animation}`).toBe('clip')
    }
  })

  /**
   * A clip is often longer than the card performing it and that is handled —
   * the blend out starts when the action does — but a card whose animation is
   * over less than half way through is a card that stands still for the rest
   * of its own QTE.
   */
  it('gives every card enough motion to cover most of it', () => {
    for (const card of CARDS) {
      const source = animationFor(card.animation)
      if (source.type !== 'clip') continue
      const { startTime = 0, endTime, loop } = source.clip
      if (loop) continue
      const played = ((endTime ?? Infinity) - startTime) / source.clip.playbackRate
      expect(played * 1000, `${card.name} → ${source.clip.id}`).toBeGreaterThan(card.durationMs / 2)
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

/**
 * The animation direction: which clip answers which moment, and the handful of
 * rules that keep the answers from tripping over each other.
 */
describe('who performs what', () => {
  const BEATS: readonly Beat[] = [
    'PERFECT',
    'GOOD',
    'MISS',
    'LOST_COMPOSURE',
    'GOD_AURA',
    'OUTAURA',
    'STREAK',
  ]

  const at = (action: FighterAction) => clipForAction(action)

  it('has a body for every beat, on both sides of it', () => {
    for (const beat of BEATS) {
      for (const kind of ['react', 'watch'] as const) {
        const cue = at({ kind, beat, startedAt: 0, durationMs: 900 })
        // A GOOD is a nod, and the pose system already has one.
        if (beat === 'GOOD') expect(cue, `${kind} ${beat}`).toBeNull()
        else expect(cue, `${kind} ${beat}`).not.toBeNull()
      }
    }
  })

  it('celebrates and slumps with a clip', () => {
    expect(at({ kind: 'finale', won: true })?.clip.id).toBe('victory-idle')
    expect(at({ kind: 'finale', won: false })?.clip.id).toBe('defeat')
  })

  /**
   * Standing there is not something a fighter is asked to do, it is what is
   * left when nothing is being asked — the resting animation is under every
   * frame of every action. Handing the idle out as a cue as well would have it
   * blending against itself.
   */
  it('asks for nothing while a fighter is idle', () => {
    expect(at({ kind: 'idle' })).toBeNull()
    expect(REST_CLIP.id).toBe('neutral-idle')
    expect(REST_CLIP.loop, 'the resting animation has to tile').toBe(true)
  })

  /**
   * The one exception to everything below. Both endings hold for as long as the
   * result screen is up, which is until somebody taps, so both loop and neither
   * ever gives the body back.
   */
  it('lets only the finale outlast its own length', () => {
    for (const won of [true, false]) {
      expect(at({ kind: 'finale', won })?.loop, `finale ${won}`).toBe(true)
    }
  })

  /**
   * A card, a reaction and an answer all end and hand the body back to the
   * idle underneath. A fighter used to hold the last frame of whichever of them
   * ran most recently for the rest of the phase — arms over their head, after a
   * PERFECT, until somebody swiped.
   */
  it('gives the body back after everything else', () => {
    for (const beat of BEATS) {
      for (const kind of ['react', 'watch'] as const) {
        const cue = at({ kind, beat, startedAt: 0, durationMs: 900 })
        if (cue) expect(cue.loop, `${kind} ${beat}`).toBe(false)
      }
    }
  })

  /**
   * Except a card short enough to need it. A one-second moonwalk in a
   * three-second card is better round three times than once and then standing
   * there, and only a clip whose ends meet may do it.
   */
  it('tiles a card clip only when the clip can take it', () => {
    for (const card of CARDS) {
      const cue = at({
        kind: 'move',
        animation: card.animation,
        startedAt: 0,
        durationMs: card.durationMs,
      })
      expect(cue?.loop, `${card.name}`).toBe(cue?.clip.loop)
    }
  })

  /** 400 ms, three frames longer than the blend that would introduce a clip. */
  it('leaves the wind-up to the pose system', () => {
    expect(at({ kind: 'windUp', startedAt: 0, durationMs: 400 })).toBeNull()
  })

  /**
   * A reaction follows the card that earned it with nothing in between, so a
   * beat answered by a clip some card also performs would play the same motion
   * twice and read as a stutter rather than an answer.
   */
  it('never answers a card with the card', () => {
    const dealt = new Set(DEALT_CLIPS.map((clip) => clip.id))
    for (const beat of BEATS) {
      const cue = at({ kind: 'react', beat, startedAt: 0, durationMs: 900 })
      if (cue) expect(dealt.has(cue.clip.id), `react ${beat} → ${cue.clip.id}`).toBe(false)
    }
  })

  /**
   * Every clip a fighter can be asked for is fetched before the battle, because
   * a reaction that arrives after its own moment is a reaction nobody saw.
   */
  it('preloads everything anything names, and nothing else', () => {
    const named = new Set<string>()
    for (const card of CARDS) named.add(card.animation)
    for (const beat of BEATS) {
      for (const kind of ['react', 'watch'] as const) {
        const cue = at({ kind, beat, startedAt: 0, durationMs: 900 })
        if (cue) named.add(cue.clip.id)
      }
    }
    for (const action of [{ kind: 'finale', won: true }, { kind: 'finale', won: false }] as const) {
      const cue = at(action)
      if (cue) named.add(cue.clip.id)
    }
    // Not an action's clip, and still the one every body needs first.
    named.add(REST_CLIP.id)

    expect(new Set(USED_CLIPS.map((clip) => clip.id))).toEqual(named)
    expect(USED_CLIPS.length).toBe(
      new Set([...DEALT_CLIPS, ...STATE_CLIPS].map((clip) => clip.id)).size,
    )
    // The registry is the range, not the cast. Some of it is only ever looked
    // at in the lab, and none of that is downloaded or shipped.
    expect(USED_CLIPS.length).toBeLessThan(ALL_CLIPS.length)
  })

  /**
   * Deliberately not one list: a card is dealt from a deck and a reaction is
   * not, and the setup screen fetches both for different reasons.
   */
  it('keeps the dealt clips and the rest apart', () => {
    const dealt = new Set(DEALT_CLIPS.map((clip) => clip.id))
    expect(DEALT_CLIPS.map((clip) => clip.id).sort()).toEqual(
      [...new Set(CARDS.map((card) => card.animation))].sort(),
    )
    for (const clip of STATE_CLIPS) expect(dealt.has(clip.id), clip.id).toBe(false)
  })

  it('starts a clip when its action did, so both bodies agree on the frame', () => {
    const card = getCard('speedrun')
    const cue = at({
      kind: 'move',
      animation: card.animation,
      startedAt: 4200,
      durationMs: card.durationMs,
    })
    expect(cue?.startedAt).toBe(4200)
  })

})

/**
 * Nothing a fighter does may outlive the doing of it. Every shape in the pose
 * system is a function of how far through its own span it is, and the span runs
 * out long before the phase carrying it does — a reaction is 900 ms and the
 * resolve screen stays up until somebody swipes.
 */
describe('a pose at the end of its span', () => {
  const BEATS: readonly Beat[] = [
    'PERFECT',
    'GOOD',
    'MISS',
    'LOST_COMPOSURE',
    'GOD_AURA',
    'OUTAURA',
    'STREAK',
  ]
  const KEYS = Object.keys(NEUTRAL) as (keyof Pose)[]
  const drift = (p: Pose) => KEYS.reduce((sum, k) => sum + Math.abs(p[k] - NEUTRAL[k]), 0)

  /**
   * This is the one that was wrong, and it was visible from across the room.
   * `reactPose`'s PERFECT throws the arms up with `snap(p * 2)`, which reaches
   * 1 half way through and — `snap` being clamped — never comes back down. The
   * fighter held their arms over their head for the rest of the turn.
   */
  it('is standing again, on both sides of every beat', () => {
    for (const beat of BEATS) {
      expect(drift(reactPose(beat, 1)), `react ${beat}`).toBeLessThan(0.05)
      expect(drift(watchPose(beat, 1)), `watch ${beat}`).toBeLessThan(0.05)
    }
  })

  it('starts from standing too, so nothing snaps into frame', () => {
    for (const beat of BEATS) {
      expect(drift(reactPose(beat, 0)), `react ${beat}`).toBeLessThan(0.05)
      expect(drift(watchPose(beat, 0)), `watch ${beat}`).toBeLessThan(0.05)
    }
  })

  it('still has something to say in the middle of it', () => {
    for (const beat of BEATS) {
      expect(drift(reactPose(beat, 0.4)), `react ${beat}`).toBeGreaterThan(0.3)
    }
  })

  it('comes out of the crouch it winds up into', () => {
    expect(drift(windUpPose(0))).toBeLessThan(0.05)
    expect(drift(windUpPose(1))).toBeLessThan(0.05)
  })

  /** The exception, and the only one: an ending is meant to be held. */
  it('leaves the finale holding, because nothing follows it', () => {
    expect(drift(finalePose(true, 3))).toBeGreaterThan(1)
    expect(drift(finalePose(false, 3))).toBeGreaterThan(1)
  })
})
