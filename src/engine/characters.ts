import type { Character } from './types'

/**
 * Four fighters, one per silhouette. The `build` note is the brief for the
 * procedural low-poly model that replaces the emoji in F4 — the names describe
 * geometry on purpose, so the 3D pass has something concrete to hit.
 */
export const CHARACTERS: readonly Character[] = [
  {
    id: 'blocky',
    name: 'BLOCKY',
    emoji: '🧱',
    color: '#f97316',
    build: 'wide box torso, stubby limbs, heavy stomp',
  },
  {
    id: 'noodle',
    name: 'NOODLE',
    emoji: '🍜',
    color: '#22d3ee',
    build: 'tall and thin, floppy overshoot on every pose',
  },
  {
    id: 'orb',
    name: 'ORB',
    emoji: '🔮',
    color: '#c084fc',
    build: 'round body, tiny limbs, bouncy squash and stretch',
  },
  {
    id: 'chad',
    name: 'CHAD',
    emoji: '🗿',
    color: '#4ade80',
    build: 'huge shoulders, small head, slow and deliberate',
  },
]

const BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]))

export function getCharacter(id: string): Character {
  const character = BY_ID.get(id)
  if (!character) throw new Error(`Unknown character: ${id}`)
  return character
}
