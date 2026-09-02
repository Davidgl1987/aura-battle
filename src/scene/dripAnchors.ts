import { bySlot } from '../engine/accessories'
import type { Accessory, AccessorySlot } from '../engine/types'

/**
 * Where each slot hangs off a fighter. Kept apart from the meshes so it can be
 * read without a renderer, the way `stageState` and `builds` are.
 *
 * `root` is outside the body group on purpose: squash and stretch belongs to
 * the fighter, not to a ring orbiting them.
 */
export type Anchor = 'head' | 'body' | 'root'

export const ANCHOR: Record<AccessorySlot, Anchor> = {
  hat: 'head',
  glasses: 'head',
  mask: 'head',
  headphones: 'head',
  torso: 'body',
  gloves: 'body',
}

/** The accessories that hang off one anchor, at most one per slot. */
export function dripFor(accessories: readonly string[] | undefined, anchor: Anchor): Accessory[] {
  if (!accessories?.length) return []
  return bySlot(accessories).filter((a) => ANCHOR[a.slot] === anchor)
}
