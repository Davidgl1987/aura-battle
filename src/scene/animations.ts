import type { Judgement } from '../engine/types'
import type { Build } from './builds'
import { NEUTRAL, type Pose, TAU, arc, blend, hold, overshoot, pose, snap, wave } from './pose'

/** A move, described over its own span: 0 is the first frame, 1 the last. */
export type PoseFn = (p: number) => Pose

const HALF_PI = Math.PI / 2

/**
 * One entry per card's `animation` key. Each one is built from the same
 * fifteen numbers, so a gesture is readable as code: "hands to the jaw, chin
 * up, hold" really is what mewing says.
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
 * A move as it is actually performed: wrapped in a ramp so the fighter rises
 * out of standing and returns to it. Authored moves are free to sit at their
 * extreme from the first frame — several of them hold the arms up throughout —
 * and without this they would snap into frame like a bad cut.
 */
export function moveAt(animation: string, p: number): Pose {
  return blend(NEUTRAL, moveFor(animation)(p), hold(p, 0.14, 0.86))
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

/** What the body does about the result. */
export function reactPose(judgement: Judgement | 'LOST_COMPOSURE', p: number): Pose {
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
export function watchPose(judgement: Judgement | 'LOST_COMPOSURE', p: number): Pose {
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

/** Ease between whatever was showing and what should be showing now. */
export function settle(from: Pose, to: Pose, delta: number, rate = 12): Pose {
  return blend(from, to, 1 - Math.exp(-rate * delta))
}

export const RESTING = NEUTRAL
