/**
 * A fighter's whole body in fifteen numbers. Animations are pure functions
 * producing one of these, so the look of a move can be tested and tweaked
 * without a renderer anywhere in sight.
 *
 * Angles are radians. Arms hang down at 0; raise swings them out to the side,
 * swing carries them forward, elbow folds them.
 */
export interface Pose {
  /** Height above the fighter's ground anchor. */
  y: number
  /** Whole-body spin. */
  turn: number
  /** Torso pitch: positive leans forward. */
  lean: number
  /** Torso roll: positive tips to their left. */
  tilt: number
  headPitch: number
  headYaw: number
  armRaiseL: number
  armRaiseR: number
  armSwingL: number
  armSwingR: number
  elbowL: number
  elbowR: number
  legL: number
  legR: number
  /** Squash and stretch. 1 is neutral, above 1 is stretched tall. */
  squash: number
}

export const NEUTRAL: Pose = {
  y: 0,
  turn: 0,
  lean: 0,
  tilt: 0,
  headPitch: 0,
  headYaw: 0,
  armRaiseL: 0.12,
  armRaiseR: 0.12,
  armSwingL: 0,
  armSwingR: 0,
  elbowL: 0.1,
  elbowR: 0.1,
  legL: 0,
  legR: 0,
  squash: 1,
}

const KEYS = Object.keys(NEUTRAL) as (keyof Pose)[]

export function pose(partial: Partial<Pose>): Pose {
  return { ...NEUTRAL, ...partial }
}

/** Mix two poses. `k` of 0 is all `a`, 1 is all `b`. */
export function blend(a: Pose, b: Pose, k: number): Pose {
  const t = Math.min(1, Math.max(0, k))
  const out = {} as Pose
  for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * t
  return out
}

// --- Shaping helpers --------------------------------------------------------

export const TAU = Math.PI * 2

/** Smooth 0 → 1 → 0 over the whole span: the shape of a single gesture. */
export function arc(p: number): number {
  return Math.sin(Math.min(1, Math.max(0, p)) * Math.PI)
}

/** `cycles` full swings across the span, starting and ending at rest. */
export function wave(p: number, cycles: number): number {
  return Math.sin(p * TAU * cycles)
}

/** Ease-out: fast to the pose, then settles. Good for a snap. */
export function snap(p: number): number {
  const t = Math.min(1, Math.max(0, p))
  return 1 - (1 - t) * (1 - t) * (1 - t)
}

/** Rises to 1 and stays there, so a held pose reads as held. */
export function hold(p: number, rampIn = 0.18, rampOut = 0.85): number {
  if (p < rampIn) return snap(p / rampIn)
  if (p > rampOut) return snap(Math.max(0, 1 - (p - rampOut) / (1 - rampOut)))
  return 1
}

/** Wobble that dies away — how a floppy fighter settles after a move. */
export function overshoot(p: number, cycles = 3): number {
  return Math.sin(p * TAU * cycles) * Math.exp(-p * 3)
}
