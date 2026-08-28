import type { Accessory, AccessorySlot } from './types'

/**
 * What a fighter can be wearing. Nine slots, because that is the shape the
 * wardrobe will eventually have; six items, because that is how many rivals
 * there are to take one off.
 *
 * Every accessory in here is worn by the rival who gives it up, so the thing
 * you are playing for is on screen for the whole battle. `shape` is the only
 * part the stage reads — it names a small procedural mesh, not a model file,
 * for the same reason the fighters are assembled from primitives: nobody
 * downloads anything.
 */
export const ACCESSORY_SLOTS: readonly AccessorySlot[] = [
  'hair',
  'head',
  'glasses',
  'neck',
  'top',
  'bottom',
  'shoes',
  'extras',
  'aura',
]

export const SLOT_LABEL: Record<AccessorySlot, string> = {
  hair: 'Hair',
  head: 'Hat / Head',
  glasses: 'Glasses',
  neck: 'Neck',
  top: 'Top',
  bottom: 'Bottom',
  shoes: 'Shoes',
  extras: 'Extras',
  aura: 'Aura',
}

export const ACCESSORIES: readonly Accessory[] = [
  {
    id: 'starter-cap',
    name: 'Starter Cap',
    emoji: '🧢',
    slot: 'head',
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
    id: 'jawline-chain',
    name: 'Jawline Chain',
    emoji: '🧊',
    slot: 'neck',
    shape: 'chain',
    color: '#e0f2fe',
  },
  {
    id: 'drip-jacket',
    name: 'Drip Jacket',
    emoji: '🧥',
    slot: 'top',
    shape: 'jacket',
    color: '#7c3aed',
  },
  {
    id: 'dice-charm',
    name: 'Dice Charm',
    emoji: '🎲',
    slot: 'extras',
    shape: 'charm',
    color: '#fef3c7',
  },
  {
    id: 'demon-aura',
    name: 'Demon Aura',
    emoji: '😈',
    slot: 'aura',
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
