import { CARDS } from '../engine/cards'
import type { Judgement } from '../engine/types'
import type { Build } from './builds'
import { clipFor, type ExternalClip } from './clips'
import { NEUTRAL, type Pose, TAU, arc, blend, hold, overshoot, pose, snap, wave } from './pose'
import { actionProgress, type Beat, type FighterAction } from './stageState'

/** A move, described over its own span: 0 is the first frame, 1 the last. */
export type PoseFn = (p: number) => Pose

const HALF_PI = Math.PI / 2

/**
 * The hand-authored gestures, each built from the same fifteen numbers, so a
 * gesture is readable as code: "hands to the jaw, chin up, hold" really is what
 * mewing says.
 *
 * There was one of these per card until every card moved onto an imported clip,
 * and no card names one now. They are kept because the lab still steps through
 * them and because putting a card back on one is a single string — the cheapest
 * way there is to disagree with the animation direction. `docs/firetoy.md`
 * records what else of the pose system is still load-bearing, which is more
 * than this is.
 */
export const MOVES: Record<string, PoseFn> = {
  // 😤 Hands framing the jawline, chin up, dead still. All in the snap.
  mewing: (p) => {
    const k = hold(p, 0.12)
    return pose({
      armRaiseL: 0.9 * k,
      armRaiseR: 0.9 * k,
      armSwingL: 1.15 * k,
      armSwingR: 1.15 * k,
      elbowL: 2.3 * k,
      elbowR: 2.3 * k,
      headPitch: -0.34 * k,
      lean: -0.1 * k,
      y: 0.03 * k,
    })
  },

  // 🕶️ Arms folded, head turning slowly until it locks onto you.
  stare: (p) => {
    const k = hold(p, 0.2)
    return pose({
      armRaiseL: 0.34 * k,
      armRaiseR: 0.34 * k,
      armSwingL: 1.35 * k,
      armSwingR: 1.35 * k,
      elbowL: 2.55 * k,
      elbowR: 2.55 * k,
      headYaw: 0.75 * (1 - snap(p)) - 0.05 * k,
      lean: -0.14 * k,
      turn: 0.18 * (1 - snap(p)),
    })
  },

  // 🔒 Coiled and still: fists in at the ribs, head down, then up and on you.
  //    The only move in the set whose whole point is not moving.
  lockedIn: (p) => {
    const k = hold(p, 0.16)
    const lock = snap(Math.min(1, p * 1.6))
    return pose({
      armRaiseL: 0.55 * k,
      armRaiseR: 0.55 * k,
      armSwingL: 0.88 * k,
      armSwingR: 0.88 * k,
      elbowL: 2.15 * k,
      elbowR: 2.15 * k,
      headPitch: (0.3 - lock * 0.44) * k,
      lean: 0.16 * k,
      squash: 1 - 0.05 * k,
      y: -0.04 * k,
    })
  },

  // 🔢 Ranking something invisible: arm out, jabbing its way down the list.
  tierList: (p) => {
    const k = hold(p, 0.1)
    const jab = wave(p, 5)
    const down = snap(p)
    return pose({
      armRaiseR: (1.2 - down * 0.8 + jab * 0.14) * k,
      armSwingR: 0.4 * k,
      elbowR: (0.55 - Math.abs(jab) * 0.4) * k,
      // The other hand stays parked on the hip, unimpressed.
      armRaiseL: 0.32 * k,
      armSwingL: 1.25 * k,
      elbowL: 2.0 * k,
      headPitch: (0.08 + down * 0.26) * k,
      lean: 0.1 * k,
    })
  },

  // ⏱️ Legs going, arms pumping, checking a wrist that is not there.
  speedrun: (p) => {
    const k = hold(p, 0.08)
    const stride = wave(p, 6)
    return pose({
      legL: 0.85 * stride * k,
      legR: -0.85 * stride * k,
      armRaiseL: (0.5 - stride * 0.45) * k,
      armRaiseR: (0.5 + stride * 0.45) * k,
      elbowL: 1.9 * k,
      elbowR: 1.9 * k,
      armSwingL: 0.3 * k,
      armSwingR: 0.3 * k,
      lean: 0.32 * k,
      headPitch: -0.12 * k,
      y: Math.abs(stride) * 0.05 * k,
    })
  },

  // 🎵 Head on the beat, one hand dropping with it.
  beatDrop: (p) => {
    const k = hold(p, 0.12)
    const beat = wave(p, 4)
    return pose({
      headPitch: (0.14 + beat * 0.22) * k,
      armRaiseR: (0.95 + beat * 0.5) * k,
      elbowR: (1.5 - beat * 0.5) * k,
      armSwingR: 0.55 * k,
      armRaiseL: 0.28 * k,
      elbowL: 2.1 * k,
      armSwingL: 1.15 * k,
      tilt: beat * 0.12 * k,
      y: Math.max(0, -beat) * 0.07 * k,
      squash: 1 - Math.max(0, -beat) * 0.07 * k,
    })
  },

  // 🎧 The same idea at twice the rate, with the whole body in it.
  hyperpop: (p) => {
    const k = hold(p, 0.08)
    const beat = wave(p, 8)
    return pose({
      armRaiseL: (1.5 + beat * 0.35) * k,
      armRaiseR: (1.5 - beat * 0.35) * k,
      armSwingL: 0.7 * k,
      armSwingR: -0.7 * k,
      elbowL: 0.9 * k,
      elbowR: 0.9 * k,
      headPitch: beat * 0.2 * k,
      turn: beat * 0.16 * k,
      y: Math.abs(beat) * 0.1 * k,
      squash: 1 + Math.abs(beat) * 0.06 * k,
    })
  },

  // 🤞 Both hands out front, tracing two things at once, eyes between them.
  splitFocus: (p) => {
    const k = hold(p, 0.14)
    const left = wave(p, 2)
    const right = wave(p + 0.25, 2)
    return pose({
      armRaiseL: (1.05 + left * 0.28) * k,
      armRaiseR: (1.05 + right * 0.28) * k,
      armSwingL: (0.5 + left * 0.3) * k,
      armSwingR: (-0.5 + right * 0.3) * k,
      elbowL: 0.75 * k,
      elbowR: 0.75 * k,
      headYaw: (left - right) * 0.16 * k,
      headPitch: 0.12 * k,
      lean: 0.08 * k,
    })
  },

  // 🧠 Arms opening wide, head back, quietly leaving the ground.
  galaxyBrain: (p) => {
    const k = hold(p, 0.2)
    const rise = snap(Math.min(1, p * 1.4))
    return pose({
      armRaiseL: (0.9 + rise * 0.85) * k,
      armRaiseR: (0.9 + rise * 0.85) * k,
      armSwingL: 1.05 * k,
      armSwingR: -1.05 * k,
      elbowL: 0.25 * k,
      elbowR: 0.25 * k,
      headPitch: -0.4 * rise * k,
      y: 0.24 * rise * k + overshoot(p, 2) * 0.02,
      squash: 1 + 0.08 * rise * k,
    })
  },

  // 🧊 Each hand sweeps down the other forearm. Twice.
  iceVeins: (p) => {
    const sweep = wave(p, 2)
    return pose({
      armRaiseL: 1.15 + 0.35 * sweep,
      armRaiseR: 1.15 - 0.35 * sweep,
      armSwingL: 0.85 + 0.3 * sweep,
      armSwingR: 0.85 - 0.3 * sweep,
      elbowL: 1.9,
      elbowR: 1.9,
      tilt: 0.12 * sweep,
      headPitch: -0.12,
      lean: -0.08,
    })
  },

  // 🕺 Legs swapping fast, hands doing the goggles by the eyes.
  griddy: (p) => {
    const step = wave(p, 3)
    const circle = p * TAU * 3
    return pose({
      legL: 0.75 * Math.max(0, step),
      legR: 0.75 * Math.max(0, -step),
      armRaiseL: 1.15 + 0.18 * Math.sin(circle),
      armRaiseR: 1.15 + 0.18 * Math.sin(circle + Math.PI),
      armSwingL: 1.05 + 0.2 * Math.cos(circle),
      armSwingR: 1.05 + 0.2 * Math.cos(circle + Math.PI),
      elbowL: 2.35,
      elbowR: 2.35,
      tilt: 0.1 * step,
      y: 0.05 * Math.abs(step),
      lean: 0.08,
    })
  },

  // ✌️ Both hands out, alternating up and down on the count.
  sixSeven: (p) => {
    const beat = wave(p, 3)
    return pose({
      armRaiseL: 1.3 + 0.42 * beat,
      armRaiseR: 1.3 - 0.42 * beat,
      armSwingL: 0.55,
      armSwingR: 0.55,
      elbowL: 1.15,
      elbowR: 1.15,
      tilt: 0.14 * beat,
      headYaw: 0.16 * beat,
      y: 0.03 * Math.abs(beat),
    })
  },

  // 👏 Hands meeting in front, over and over.
  clap: (p) => {
    const close = (wave(p, 4) + 1) / 2
    return pose({
      armRaiseL: 0.95 - 0.72 * close,
      armRaiseR: 0.95 - 0.72 * close,
      armSwingL: 1.2,
      armSwingR: 1.2,
      elbowL: 1.55,
      elbowR: 1.55,
      lean: 0.12 + 0.08 * close,
      headPitch: 0.1 * close,
      y: 0.02 * close,
    })
  },

  // 🦵 Kicks out to the side, weight thrown the other way.
  sturdy: (p) => {
    const kick = wave(p, 2)
    return pose({
      legL: 0.85 * Math.max(0, kick),
      legR: 0.85 * Math.max(0, -kick),
      tilt: -0.28 * kick,
      armRaiseL: 0.75 - 0.35 * kick,
      armRaiseR: 0.75 + 0.35 * kick,
      armSwingL: 0.9 * kick,
      armSwingR: -0.9 * kick,
      elbowL: 1.1,
      elbowR: 1.1,
      lean: 0.16,
      y: 0.04 * Math.abs(kick),
    })
  },

  // 🧍 Straight out, and stay there.
  tpose: (p) => {
    const k = hold(p, 0.15)
    return pose({
      armRaiseL: HALF_PI * k,
      armRaiseR: HALF_PI * k,
      elbowL: 0.02,
      elbowR: 0.02,
      y: 0.05 * k,
      squash: 1 + 0.04 * k,
    })
  },

  // 🫠 Tipped over as far as it goes, one arm counterweighting.
  lean: (p) => {
    const k = hold(p, 0.22)
    return pose({
      tilt: 0.62 * k,
      lean: 0.1 * k,
      armRaiseL: 1.55 * k,
      armRaiseR: 0.3 * k,
      armSwingL: 0.25 * k,
      elbowL: 0.5 * k,
      headPitch: 0.12 * k,
      headYaw: -0.25 * k,
    })
  },

  // 🧘 Off the ground, turning, arms open.
  levitate: (p) => {
    const k = hold(p, 0.3, 0.9)
    return pose({
      y: 0.42 * k,
      turn: p * 1.1,
      armRaiseL: 0.85 * k,
      armRaiseR: 0.85 * k,
      elbowL: 0.05,
      elbowR: 0.05,
      headPitch: -0.2 * k,
      squash: 1 + 0.07 * k,
      legL: 0.35 * k,
      legR: 0.35 * k,
    })
  },
}

export function moveFor(animation: string): PoseFn {
  return MOVES[animation] ?? MOVES.tpose
}

/**
 * What a card's `animation` key names: one of the pose functions above, or an
 * imported clip. The single place that decides, so that a card can be moved
 * from one to the other and nothing between the deck and the skeleton has to
 * know which it got.
 */
export type AnimationSource =
  | { type: 'pose'; move: PoseFn }
  | { type: 'clip'; clip: ExternalClip }

export function animationFor(animation: string): AnimationSource {
  const clip = clipFor(animation)
  return clip ? { type: 'clip', clip } : { type: 'pose', move: moveFor(animation) }
}

/**
 * The clip a fighter performs when a beat lands on them, and the one the
 * fighter opposite answers with.
 *
 * Two tables rather than one because a moment is a conversation: somebody
 * out-scores somebody. The winner waves it away and the loser fumes, and both
 * of those are the same instant of the same match. Null is not an oversight —
 * it means the pose system already has something small and right to say and a
 * clip would be too much furniture for it. A GOOD is a nod.
 */
const REACTS: Record<Beat, string | null> = {
  GOD_AURA: 'sword-and-shield-power-up',
  OUTAURA: 'dismissing-gesture',
  STREAK: 'taunt',
  PERFECT: 'victory-idle',
  GOOD: null,
  MISS: 'shaking-head-no',
  LOST_COMPOSURE: 'defeat',
}

const WATCHES: Record<Beat, string | null> = {
  // Somebody across the stage just caught fire, or beat a score with your name
  // on it. Neither is a shrug.
  GOD_AURA: 'surprised',
  OUTAURA: 'angry',
  STREAK: 'shaking-head-no',
  PERFECT: 'surprised',
  GOOD: null,
  // A fumble is an invitation, and `loser` is a hand held up to a forehead.
  MISS: 'loser',
  LOST_COMPOSURE: 'loser',
}

/**
 * Breathing on the spot.
 *
 * Not an action's clip, and that is the point: it is the layer under every
 * frame of every action, so a fighter with nothing to do is idling rather than
 * holding the last thing they were told to do. `clipPlayer.ts` writes it first
 * and always. Every body in the game needs it, so it is the one clip worth
 * having in hand before anything else.
 */
const IDLE_CLIP = 'neutral-idle'

/** The resting animation itself, for whoever has to fetch it. */
export const REST_CLIP: ExternalClip = clipFor(IDLE_CLIP)!

/** Held for as long as the result screen is up, so both of them loop. */
const FINALE_CLIPS = { won: 'victory-idle', lost: 'defeat' } as const

/** The clip an action is performed by, and how. */
export interface ClipAt {
  clip: ExternalClip
  /** The instant its playhead is measured from. */
  startedAt: number
  /**
   * Whether it runs round again. A decision about the moment rather than about
   * the file, which is why it is not simply the registry's `loop`: a card tiles
   * a short dance to fill itself, an ending holds until somebody taps, and a
   * reaction plays once and gives the body back to the idle underneath.
   */
  loop: boolean
}

/**
 * What an action looks like as imported motion, or null for the ones the pose
 * system still owns.
 *
 * The counterpart of `poseForAction`, and deliberately its own function rather
 * than a field on it: a clip and a pose are both live at once during a blend,
 * and `clipPlayer.ts` wants each of them from the source that knows.
 *
 * Two actions have no clip and will not be getting one. The wind-up is 400 ms,
 * which is three frames longer than the blend that would introduce a clip, so
 * there is nothing left to see. And a GOOD is a nod — see `REACTS`.
 */
export function clipForAction(action: FighterAction): ClipAt | null {
  const found = (id: string | null, startedAt: number, loop: boolean): ClipAt | null => {
    const clip = id === null ? undefined : clipFor(id)
    return clip ? { clip, startedAt, loop } : null
  }

  switch (action.kind) {
    case 'windUp':
      return null
    case 'move':
      // Tiled if the clip can take it: a one-second moonwalk in a three-second
      // card is better round three times than once and then standing there.
      return found(action.animation, action.startedAt, clipFor(action.animation)?.loop ?? false)
    case 'react':
      return found(REACTS[action.beat], action.startedAt, false)
    case 'watch':
      return found(WATCHES[action.beat], action.startedAt, false)
    case 'finale':
      // The one thing that never gives the body back. No instant of its own
      // either: the screen stays up until somebody taps, so the playhead is
      // measured from the clock's own zero and runs round there for good.
      return found(FINALE_CLIPS[action.won ? 'won' : 'lost'], 0, true)
    default:
      // Standing there is not an action. `neutral-idle` is already under this
      // frame and every other one — see `clipPlayer.ts`.
      return null
  }
}

/**
 * The span an action is performed over, when there is no clip to perform it
 * with: the wind-up, a GOOD, and any body whose clip file never arrived.
 *
 * A pose is performed exactly the way a clip is — faded in against the resting
 * animation, held, faded back out when its span runs out. That is the whole
 * reason this exists rather than the pose simply being written whenever no clip
 * is playing: written, it would appear and disappear on the frame a cue changed,
 * and the eleven joints it owns would jump between its idea of standing and the
 * resting clip's. Performed, it blends both ways like everything else does.
 *
 * Null for idling, which is not a performance. Standing there is what the
 * resting animation is already doing underneath.
 */
export interface Span {
  /** Distinguishes one performance from the next, the way a clip's id does. */
  id: string
  startedAt: number
  durationMs: number
  loop: boolean
}

export function spanOf(action: FighterAction): Span | null {
  switch (action.kind) {
    case 'idle':
      return null
    // The one that outlasts itself. `finalePose` loops on wall time rather than
    // running over a span, so its own length is arbitrary and it never ends.
    case 'finale':
      return { id: `finale:${action.won}`, startedAt: 0, durationMs: 1000, loop: true }
    default:
      return { id: action.kind, startedAt: action.startedAt, durationMs: action.durationMs, loop: false }
  }
}

const byId = (ids: readonly (string | null)[]): readonly ExternalClip[] => [
  ...new Map(
    ids
      .map((id) => (id === null ? undefined : clipFor(id)))
      .filter((clip): clip is ExternalClip => clip !== undefined)
      .map((clip) => [clip.id, clip]),
  ).values(),
]

/**
 * The clips a battle can actually deal, which is not the registry: every clip
 * that has been downloaded and looked at is registered, and only the ones
 * something names will ever be performed. Fetching the difference before a
 * battle would be megabytes nobody asked for.
 */
export const DEALT_CLIPS: readonly ExternalClip[] = byId(CARDS.map((card) => card.animation))

/**
 * The ones that belong to no card: standing still, the seven things a result
 * can be worth saying, and the two endings. Fetched with the cards rather than
 * on demand, because the idle is on screen before anything is dealt and a
 * reaction that arrives after its own moment is a reaction nobody saw.
 */
export const STATE_CLIPS: readonly ExternalClip[] = byId([
  IDLE_CLIP,
  ...Object.values(REACTS),
  ...Object.values(WATCHES),
  ...Object.values(FINALE_CLIPS),
])

/**
 * Everything with a consumer, which is what gets shipped. The registry holds
 * the ones that were downloaded and looked at too, and those are a public URL
 * nobody fetches — see `npm run clips -- --upload`.
 */
export const USED_CLIPS: readonly ExternalClip[] = byId([
  ...DEALT_CLIPS.map((clip) => clip.id),
  ...STATE_CLIPS.map((clip) => clip.id),
])

/**
 * A move as it is actually performed: wrapped in a ramp so the fighter rises
 * out of standing and returns to it. Authored moves are free to sit at their
 * extreme from the first frame — several of them hold the arms up throughout —
 * and without this they would snap into frame like a bad cut.
 */
export function moveAt(animation: string, p: number): Pose {
  return blend(NEUTRAL, moveFor(animation)(p), hold(p, 0.14, 0.86))
}

/**
 * A shape as it is actually performed: wrapped in the same ramp `moveAt` uses,
 * so it provably rises out of standing and returns to it.
 *
 * This is here because it did not used to be, and the bug was visible from
 * across the room. `reactPose`'s PERFECT throws the arms up with `snap(p * 2)`,
 * which reaches 1 half way through the span and — `snap` being clamped —
 * never comes back down. The reaction's span is 900 ms and the resolve screen
 * stays up until somebody swipes, so `p` sat at 1 and the fighter held their
 * arms over their head for the rest of the turn. Every other pose in the file
 * happened to be wrapped in `arc` or `hold` and returned to neutral by luck
 * rather than by rule; this is the rule.
 */
function overSpan(shape: (q: number) => Pose, p: number): Pose {
  return blend(NEUTRAL, shape(p), hold(p, 0.14, 0.8))
}

/** Breathing on the spot, scaled by how bouncy the fighter is. */
export function idlePose(seconds: number, build: Build): Pose {
  const b = build.bounce
  const breath = Math.sin(seconds * 1.9)
  const sway = Math.sin(seconds * 1.1)
  return pose({
    y: 0.035 * b * (breath + 1) * 0.5,
    squash: 1 + 0.03 * b * breath * build.rubber,
    armRaiseL: 0.14 + 0.05 * b * sway,
    armRaiseR: 0.14 - 0.05 * b * sway,
    armSwingL: 0.06 * b * sway,
    armSwingR: -0.06 * b * sway,
    headYaw: 0.09 * sway,
    tilt: 0.02 * b * sway,
  })
}

/** The crouch before a move: a beat of anticipation. */
export function windUpPose(p: number): Pose {
  return overSpan(windUpShape, p)
}

function windUpShape(p: number): Pose {
  const k = arc(p)
  return pose({
    y: -0.09 * k,
    lean: 0.22 * k,
    squash: 1 - 0.09 * k,
    armSwingL: -0.35 * k,
    armSwingR: -0.35 * k,
    elbowL: 0.4 * k,
    elbowR: 0.4 * k,
    headPitch: 0.14 * k,
  })
}

/**
 * The four the pose system was written for. The three louder beats are all a
 * play going well, so under a clip that has not arrived they read as the
 * PERFECT they are sitting on top of.
 */
function graded(beat: Beat): Judgement | 'LOST_COMPOSURE' {
  switch (beat) {
    case 'GOD_AURA':
    case 'OUTAURA':
    case 'STREAK':
      return 'PERFECT'
    default:
      return beat
  }
}

/** What the body does about the result. */
export function reactPose(beat: Beat, p: number): Pose {
  return overSpan((q) => reactShape(graded(beat), q), p)
}

function reactShape(judgement: Judgement | 'LOST_COMPOSURE', p: number): Pose {
  switch (judgement) {
    case 'PERFECT': {
      const jump = arc(p)
      return pose({
        y: 0.55 * jump,
        armRaiseL: 2.7 * snap(p * 2),
        armRaiseR: 2.7 * snap(p * 2),
        headPitch: -0.3 * jump,
        squash: 1 + 0.12 * jump,
        turn: 0.3 * jump,
      })
    }
    case 'GOOD': {
      const nod = arc(p)
      return pose({
        headPitch: 0.34 * nod,
        y: 0.1 * nod,
        armRaiseL: 0.55 * nod,
        armRaiseR: 0.55 * nod,
        elbowL: 0.9 * nod,
        elbowR: 0.9 * nod,
        lean: 0.1 * nod,
      })
    }
    case 'MISS': {
      const k = hold(p, 0.15, 0.6)
      return pose({
        lean: -0.34 * k,
        headPitch: 0.4 * k,
        tilt: 0.22 * k,
        armRaiseL: 0.5 * k,
        armRaiseR: 0.2 * k,
        elbowL: 1.1 * k,
        squash: 1 - 0.06 * k,
        turn: -0.28 * k,
      })
    }
    default: {
      // Frozen solid, shrinking into themselves.
      const k = hold(p, 0.1, 0.75)
      return pose({
        squash: 1 - 0.16 * k,
        y: -0.06 * k,
        lean: 0.3 * k,
        headPitch: 0.55 * k,
        armRaiseL: -0.06 * k,
        armRaiseR: -0.06 * k,
        elbowL: 0.05,
        elbowR: 0.05,
      })
    }
  }
}

/**
 * How the battle is remembered. This one loops on wall time rather than
 * running over a card's span: the result screen stays up until somebody taps.
 */
export function finalePose(won: boolean, seconds: number): Pose {
  if (won) {
    const hop = Math.abs(Math.sin(seconds * 3.4))
    const swing = Math.sin(seconds * 6.8)
    return pose({
      y: 0.42 * hop,
      squash: 1 + 0.1 * hop,
      armRaiseL: 2.5 + 0.25 * swing,
      armRaiseR: 2.5 - 0.25 * swing,
      elbowL: 0.25,
      elbowR: 0.25,
      headPitch: -0.28,
      turn: 0.22 * Math.sin(seconds * 1.7),
      tilt: 0.09 * swing,
    })
  }

  // Beaten: folded over, with the occasional twitch of disbelief.
  const sag = 0.9 + 0.1 * Math.sin(seconds * 1.3)
  return pose({
    lean: 0.5 * sag,
    headPitch: 0.62 * sag,
    squash: 1 - 0.1 * sag,
    y: -0.05,
    armRaiseL: 0.05,
    armRaiseR: 0.05,
    elbowL: 0.35 + 0.08 * Math.sin(seconds * 2.1),
    elbowR: 0.35 - 0.08 * Math.sin(seconds * 2.1),
    tilt: 0.05 * Math.sin(seconds * 0.9),
  })
}

/**
 * What the fighter across the stage does about someone else's result: shrinks
 * from a PERFECT, leans in to gloat over a fumble.
 */
export function watchPose(beat: Beat, p: number): Pose {
  return overSpan((q) => watchShape(graded(beat), q), p)
}

function watchShape(judgement: Judgement | 'LOST_COMPOSURE', p: number): Pose {
  const k = hold(p, 0.18, 0.7)

  switch (judgement) {
    case 'PERFECT':
      return pose({
        lean: -0.3 * k,
        headPitch: -0.22 * k,
        armRaiseL: 0.62 * k,
        armRaiseR: 0.62 * k,
        elbowL: 1.3 * k,
        elbowR: 1.3 * k,
        turn: -0.16 * k,
        squash: 1 - 0.05 * k,
      })
    case 'GOOD':
      return pose({ lean: -0.12 * k, headPitch: -0.08 * k, tilt: 0.08 * k })
    default:
      // A MISS or a fumble is an invitation to lean in and enjoy it.
      return pose({
        lean: 0.26 * k,
        headPitch: 0.16 * k,
        armRaiseL: 1.35 * k,
        armRaiseR: 0.28 * k,
        elbowL: 0.5 * k,
        tilt: -0.14 * k,
        y: 0.06 * arc(p),
      })
  }
}

/**
 * The build's own accent on top of a move: floppy fighters keep wobbling after
 * the pose lands, rubbery ones squash into it.
 */
export function flourish(base: Pose, build: Build, p: number): Pose {
  const wobble = overshoot(p, 3) * build.floppy
  return {
    ...base,
    armRaiseL: base.armRaiseL + 0.12 * wobble,
    armRaiseR: base.armRaiseR - 0.12 * wobble,
    elbowL: base.elbowL + 0.1 * wobble,
    elbowR: base.elbowR + 0.1 * wobble,
    tilt: base.tilt + 0.06 * wobble,
    headPitch: base.headPitch + 0.08 * wobble,
    squash: base.squash + 0.05 * wobble * build.rubber,
  }
}

/**
 * The pose an action is asking for, right now. The one place that decides
 * which of the above a fighter is doing, so the primitive fighters and the
 * Firetoy ones cannot drift into performing different things.
 */
export function poseForAction(action: FighterAction, build: Build, now: number): Pose {
  const p = actionProgress(action, now)
  switch (action.kind) {
    case 'windUp':
      return windUpPose(p)
    case 'move':
      // A card performed by a clip has no pose of its own. What comes back is
      // what shows under it: while the clip is being faded in and out, on a
      // body whose clip never arrived, and on a primitive fighter, which
      // cannot play one at all.
      return clipFor(action.animation)
        ? idlePose(now / 1000, build)
        : flourish(moveAt(action.animation, p), build, p)
    case 'react':
      return reactPose(action.beat, p)
    case 'watch':
      return watchPose(action.beat, p)
    case 'finale':
      return finalePose(action.won, now / 1000)
    default:
      return idlePose(now / 1000, build)
  }
}

/** Ease between whatever was showing and what should be showing now. */
export function settle(from: Pose, to: Pose, delta: number, rate = 12): Pose {
  return blend(from, to, 1 - Math.exp(-rate * delta))
}

export const RESTING = NEUTRAL
