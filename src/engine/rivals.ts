import type { Strategy } from './cpu'
import type { Objective } from './objectives'
import type { Look } from './types'

/**
 * The six of them, top to bottom. A rival is data and nothing else: no rival
 * has code of its own, and the difference between the Rookie and the Aura
 * Demon is nine numbers and a deck.
 *
 * Three things hold across all six:
 *
 * - **Their deck contains the card they give up.** You watch the move you are
 *   playing for, performed by the one holding it, before you own it.
 * - **They wear the accessory their challenge pays out**, for the same reason.
 * - **Consecutive rivals never share a build.** There are four bodies and six
 *   rivals, so two are reused — colour and drip carry the difference, and
 *   spacing them out means you never meet the same silhouette twice in a row.
 */
export interface Rival {
  id: string
  name: string
  /** One line. It is read on a phone, above a 3D model, under a countdown. */
  tagline: string
  characterId: string
  look: Look
  /** 1..5, for the dots on the select screen. Not used by any rule. */
  difficulty: number
  strategy: Strategy
  /** Exactly `SOLO_DECK_SIZE` cards, and one of them is `signatureCardId`. */
  deck: string[]
  /** The move you take off them for winning. They play it. */
  signatureCardId: string
  /** Win · aura · challenge, always in that order. */
  objectives: [Objective, Objective, Objective]
}

export const RIVALS: readonly Rival[] = [
  {
    id: 'the-rookie',
    name: 'THE ROOKIE',
    tagline: 'Plays it safe and fumbles it anyway.',
    characterId: 'orb',
    look: { color: '#94a3b8', accessories: ['starter-cap'] },
    difficulty: 1,
    strategy: {
      prefersFresh: 0.3,
      prefersHighAura: 0.3,
      prefersDifficulty: 0.1,
      prefersSafeCards: 0.8,
      chasesOutaura: 0,
      chasesMomentum: 0.1,
      qteSkill: 0.62,
      consistency: 0.30,
      jitter: 0.35,
      hesitates: 0.16,
    },
    deck: ['speedrun', 'mewing', 'six-seven', 'locked-in', 'tier-list', 'vibe-check'],
    signatureCardId: 'speedrun',
    objectives: [
      { check: { kind: 'win' }, reward: { kind: 'card', cardId: 'speedrun' } },
      { check: { kind: 'aura', amount: 4000 }, reward: { kind: 'coins', amount: 200 } },
      // A mercy rule is only a rule if somebody meets it. Against the weakest
      // rival on the ladder it fires in about two battles in five, which is
      // where MOGGED gets introduced rather than discovered by accident.
      { check: { kind: 'mogged' }, reward: { kind: 'accessory', accessoryId: 'starter-cap' } },
    ],
  },
  {
    id: '67-kid',
    name: '67 KID',
    tagline: 'Swings for the fences. Every single turn.',
    characterId: 'noodle',
    look: { color: '#fbbf24', accessories: ['sixseven-shades'] },
    difficulty: 2,
    strategy: {
      prefersFresh: 0.45,
      prefersHighAura: 0.85,
      prefersDifficulty: 0.55,
      prefersSafeCards: 0.1,
      chasesOutaura: 0.55,
      chasesMomentum: 0.25,
      qteSkill: 0.645,
      consistency: 0.40,
      jitter: 0.25,
      hesitates: 0.06,
    },
    deck: ['sturdy', 'six-seven', 'rizz-clap', 'tier-list', 'beat-drop', 'npc-mode'],
    signatureCardId: 'sturdy',
    objectives: [
      { check: { kind: 'win' }, reward: { kind: 'card', cardId: 'sturdy' } },
      { check: { kind: 'aura', amount: 5000 }, reward: { kind: 'coins', amount: 300 } },
      // He takes big swings and misses half of them, which is what leaves a
      // score small enough to be beaten by half again. Measured: the chance
      // exists in about two battles in five against a rival this loose.
      {
        check: { kind: 'outaura', count: 1 },
        reward: { kind: 'accessory', accessoryId: 'sixseven-shades' },
      },
    ],
  },
  {
    id: 'the-mewer',
    name: 'THE MEWER',
    tagline: 'Precision over spectacle. Never rushes a note.',
    characterId: 'chad',
    look: { color: '#38bdf8', accessories: ['jawline-chain'] },
    difficulty: 3,
    strategy: {
      prefersFresh: 0.55,
      prefersHighAura: 0.45,
      prefersDifficulty: 0.35,
      prefersSafeCards: 0.55,
      chasesOutaura: 0.2,
      chasesMomentum: 0.6,
      qteSkill: 0.83,
      consistency: 0.80,
      jitter: 0.10,
      hesitates: 0.03,
    },
    deck: ['griddy-drop', 'mewing', 'sigma-stare', 'beat-drop', 'lean', 'vibe-check'],
    signatureCardId: 'griddy-drop',
    objectives: [
      { check: { kind: 'win' }, reward: { kind: 'card', cardId: 'griddy-drop' } },
      { check: { kind: 'aura', amount: 6000 }, reward: { kind: 'coins', amount: 400 } },
      {
        check: { kind: 'streak', length: 2 },
        reward: { kind: 'accessory', accessoryId: 'jawline-chain' },
      },
    ],
  },
  {
    id: 'the-showoff',
    name: 'THE SHOWOFF',
    tagline: 'Never repeats a move. Lives in god aura.',
    characterId: 'orb',
    look: { color: '#c084fc', accessories: ['drip-jacket'] },
    difficulty: 4,
    strategy: {
      prefersFresh: 0.95,
      prefersHighAura: 0.45,
      prefersDifficulty: 0.4,
      prefersSafeCards: 0.35,
      chasesOutaura: 0.3,
      chasesMomentum: 0.9,
      qteSkill: 0.735,
      consistency: 0.70,
      jitter: 0.15,
      hesitates: 0.03,
    },
    // One card from each kind twice over: whatever you play, they have a
    // fresh answer to it.
    deck: ['levitate', 'beat-drop', 'rizz-clap', 'split-focus', 'sigma-stare', 'cruise-control'],
    signatureCardId: 'levitate',
    objectives: [
      { check: { kind: 'win' }, reward: { kind: 'card', cardId: 'levitate' } },
      { check: { kind: 'aura', amount: 7000 }, reward: { kind: 'coins', amount: 500 } },
      {
        check: { kind: 'godAura' },
        reward: { kind: 'accessory', accessoryId: 'drip-jacket' },
      },
    ],
  },
  {
    id: 'the-gambler',
    name: 'THE GAMBLER',
    tagline: 'Hard cards only. Wins big or falls apart.',
    characterId: 'noodle',
    look: { color: '#f472b6', accessories: ['dice-charm'] },
    difficulty: 4,
    strategy: {
      prefersFresh: 0.5,
      // The one rival whose appetite for risk outweighs the maths: they reach
      // for the hardest thing in hand whether or not it is the best play.
      prefersHighAura: 0.35,
      prefersDifficulty: 0.95,
      prefersSafeCards: 0,
      chasesOutaura: 0.7,
      chasesMomentum: 0.3,
      qteSkill: 0.875,
      consistency: 0.25,
      jitter: 0.20,
      hesitates: 0.02,
    },
    deck: ['hyperpop', 'sturdy', 'speedrun', 'levitate', 'griddy-drop', 'split-focus'],
    signatureCardId: 'hyperpop',
    objectives: [
      { check: { kind: 'win' }, reward: { kind: 'card', cardId: 'hyperpop' } },
      { check: { kind: 'aura', amount: 8000 }, reward: { kind: 'coins', amount: 700 } },
      // Their own lesson, handed back: bring the dangerous cards and land them.
      {
        check: { kind: 'hardLanded', count: 3 },
        reward: { kind: 'accessory', accessoryId: 'dice-charm' },
      },
    ],
  },
  {
    id: 'aura-demon',
    name: 'AURA DEMON',
    tagline: 'Reads you, out-scores you, and never breaks.',
    characterId: 'chad',
    look: { color: '#fb7185', accessories: ['demon-aura'] },
    difficulty: 5,
    strategy: {
      prefersFresh: 0.9,
      // Globally good decisions: the expected bill of this turn, given
      // everything on the table, is what they actually optimise for.
      prefersHighAura: 0.95,
      prefersDifficulty: 0.55,
      prefersSafeCards: 0.4,
      chasesOutaura: 0.6,
      chasesMomentum: 0.8,
      qteSkill: 0.70,
      consistency: 0.90,
      jitter: 0.05,
      hesitates: 0.00,
    },
    deck: ['galaxy-brain', 'griddy-drop', 'sturdy', 'hyperpop', 'split-focus', 'levitate'],
    signatureCardId: 'galaxy-brain',
    objectives: [
      { check: { kind: 'win' }, reward: { kind: 'card', cardId: 'galaxy-brain' } },
      { check: { kind: 'aura', amount: 9500 }, reward: { kind: 'coins', amount: 1000 } },
      {
        check: { kind: 'streak', length: 3 },
        reward: { kind: 'accessory', accessoryId: 'demon-aura' },
      },
    ],
  },
]

const BY_ID = new Map(RIVALS.map((r) => [r.id, r]))

export function getRival(id: string): Rival {
  const rival = BY_ID.get(id)
  if (!rival) throw new Error(`Unknown rival: ${id}`)
  return rival
}

export const FIRST_RIVAL = RIVALS[0].id

/** Where a rival sits on the ladder, and who comes after them. */
export function rivalIndex(id: string): number {
  return RIVALS.findIndex((r) => r.id === id)
}

export function nextRival(id: string): Rival | null {
  return RIVALS[rivalIndex(id) + 1] ?? null
}
