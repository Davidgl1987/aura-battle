import { CHARACTERS } from '../engine/characters'

export type Shape = 'box' | 'capsule' | 'sphere'

/**
 * The proportions each fighter is assembled from. These are the `build` notes
 * on the characters turned into numbers — BLOCKY really is a wide box with
 * stubby limbs, NOODLE really is tall, thin and floppy.
 */
export interface Build {
  shape: Shape
  torso: [width: number, height: number, depth: number]
  headSize: number
  /** Distance from the centre line to each shoulder. */
  shoulder: number
  armLength: number
  armThickness: number
  legLength: number
  legThickness: number
  /** How much the idle breathes and bobs. */
  bounce: number
  /** How much a move overshoots and wobbles on the way out. */
  floppy: number
  /** How far squash and stretch is pushed. */
  rubber: number
  /** Everything scaled, so silhouettes differ in height too. */
  scale: number
}

export const BUILDS: Record<string, Build> = {
  blocky: {
    shape: 'box',
    torso: [0.92, 0.8, 0.62],
    headSize: 0.46,
    shoulder: 0.52,
    armLength: 0.46,
    armThickness: 0.19,
    legLength: 0.4,
    legThickness: 0.22,
    bounce: 0.55,
    floppy: 0.2,
    rubber: 0.35,
    scale: 1,
  },
  noodle: {
    shape: 'capsule',
    torso: [0.34, 1.12, 0.34],
    headSize: 0.38,
    shoulder: 0.24,
    armLength: 0.82,
    armThickness: 0.1,
    legLength: 0.86,
    legThickness: 0.11,
    bounce: 1.25,
    floppy: 1.7,
    rubber: 0.5,
    scale: 1.04,
  },
  orb: {
    shape: 'sphere',
    torso: [0.86, 0.8, 0.86],
    headSize: 0.44,
    shoulder: 0.4,
    armLength: 0.34,
    armThickness: 0.13,
    legLength: 0.26,
    legThickness: 0.15,
    bounce: 1.6,
    floppy: 0.9,
    rubber: 1,
    scale: 0.94,
  },
  chad: {
    shape: 'box',
    torso: [1.02, 0.92, 0.58],
    headSize: 0.31,
    shoulder: 0.62,
    armLength: 0.62,
    armThickness: 0.2,
    legLength: 0.56,
    legThickness: 0.24,
    bounce: 0.4,
    floppy: 0.25,
    rubber: 0.2,
    scale: 1.08,
  },
}

export function getBuild(characterId: string): Build {
  const build = BUILDS[characterId]
  if (!build) throw new Error(`No build for character: ${characterId}`)
  return build
}

/** Where the shoulders sit, measured from the fighter's ground anchor. */
export function shoulderHeight(build: Build): number {
  return build.legLength + build.torso[1] * 0.82
}

/**
 * Top of the head, from the ground, standing still. Silhouettes differ by
 * nearly half again between the shortest and the tallest, so anything framing
 * a single fighter has to ask rather than assume.
 */
export function standingHeight(build: Build): number {
  return (build.legLength + build.torso[1] + build.headSize) * build.scale
}

export const CHARACTER_IDS = CHARACTERS.map((c) => c.id)
