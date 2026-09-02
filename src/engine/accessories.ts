import type { Accessory, AccessorySlot } from './types'

/**
 * What a fighter can be wearing. Six slots and six items, one per rival.
 *
 * Every accessory in here is a real piece of the Firetoy wardrobe, worn by the
 * rival who gives it up, so the thing you are playing for is on screen for the
 * whole battle. `src/scene/firetoy/cast.ts` says which node each one is.
 *
 * These used to be nine invented slots holding six procedural shapes — a
 * chain, a charm, an aura — and three of them named things the character pack
 * does not contain. The ids are unchanged even where the names are not: a
 * player's unlocks are saved under them, and `jawline-chain` is a real pair of
 * headphones on a real head, which is worth more than a tidy identifier.
 */
export const ACCESSORY_SLOTS: readonly AccessorySlot[] = [
  'hat',
  'glasses',
  'mask',
  'headphones',
  'torso',
  'gloves',
]

export const SLOT_LABEL: Record<AccessorySlot, string> = {
  hat: 'Hat',
  glasses: 'Glasses',
  mask: 'Mask',
  headphones: 'Headphones',
  torso: 'Top',
  gloves: 'Gloves',
}

export const ACCESSORIES: readonly Accessory[] = [
  {
    // A safety helmet, for the rival whose whole problem is playing it safe.
    id: 'starter-cap',
    name: 'Safety Helmet',
    emoji: '🪖',
    slot: 'hat',
    shape: 'cap',
    color: '#94a3b8',
  },
  {
    id: 'sixseven-shades',
    name: '67 Shades',
    emoji: '🕶️',
    slot: 'glasses',
    shape: 'shades',
    color: '#1c1633',
  },
  {
    // Was a chain. Firetoy has no chains, and the Mewer never rushes a note.
    id: 'jawline-chain',
    name: 'Studio Cans',
    emoji: '🎧',
    slot: 'headphones',
    shape: 'chain',
    color: '#e0f2fe',
  },
  {
    id: 'drip-jacket',
    name: 'Drip Jacket',
    emoji: '🧥',
    slot: 'torso',
    shape: 'jacket',
    color: '#7c3aed',
  },
  {
    // Was a charm on a wrist. Now the gloves the wrists are actually wearing.
    id: 'dice-charm',
    name: 'Lucky Gloves',
    emoji: '🎲',
    slot: 'gloves',
    shape: 'charm',
    color: '#fef3c7',
  },
  {
    // Was a ring of light. The aura is the bloom on the stage; this is the face
    // the Aura Demon keeps behind it.
    id: 'demon-aura',
    name: 'Demon Mask',
    emoji: '😈',
    slot: 'mask',
    shape: 'auraRing',
    color: '#fb7185',
  },
]

const BY_ID = new Map(ACCESSORIES.map((a) => [a.id, a]))

export function getAccessory(id: string): Accessory {
  const accessory = BY_ID.get(id)
  if (!accessory) throw new Error(`Unknown accessory: ${id}`)
  return accessory
}

/**
 * One item per slot, last one winning. Nothing today equips two things in the
 * same slot, but a rival's look and a player's wardrobe both go through here
 * and neither should be able to put two hats on one head.
 */
export function bySlot(ids: readonly string[]): Accessory[] {
  const slots = new Map<AccessorySlot, Accessory>()
  for (const id of ids) {
    const accessory = getAccessory(id)
    slots.set(accessory.slot, accessory)
  }
  return [...slots.values()]
}
