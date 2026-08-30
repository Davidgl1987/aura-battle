import type { Card, Difficulty, QteKind } from './types'

/**
 * The card pool: eighteen cards, three of each gesture, one at each tier.
 *
 * Every gesture now carries its own difficulty axis rather than borrowing one
 * from the clock — the sweep puts more zones on the bar, the chart lets shorter
 * notes in, the mash adds a pad to walk along, the number pad holds more at
 * once, the ring shrinks and the driving lanes narrow. A hard card is one you
 * can see is hard before you touch it.
 *
 * The counts on each QTE are opportunity counts: a gesture is scored over its
 * whole length, so `goodAt`, `notes` and `visible` all say the same thing —
 * how many chances the card offers between the first frame of the animation
 * and the last. They sit in the same band on purpose, because `engine/qte.ts`
 * divides every ledger by its own card's number and a card with far more
 * chances than the rest would be a card with far more to go wrong.
 *
 * `kind` is what freshness is measured on, and it stays at three. `game` is the
 * minigame the card actually runs, and there are two of those per kind: adding
 * minigames without adding kinds is what keeps varying your answers worth the
 * same as it was worth before they existed.
 *
 * The HARD of each gesture is the card a rival hands over, which is why there
 * are exactly six of them and exactly six rivals.
 */
export const CARDS: readonly Card[] = [
  // --- Timing: the sweeping bar ----------------------------------------------
  // A bar must come past the centre at least twice more often than it asks to
  // be hit: once for the fumble a GOOD is allowed, once for the room above it.
  {
    id: 'mewing',
    name: 'Mewing',
    emoji: '😤',
    kind: 'timing',
    difficulty: 1,
    durationMs: 3300,
    baseAura: 900,
    animation: 'mewing',
    qte: {
      kind: 'timing',
      game: 'sweep',
      sweepMs: 800,
      zones: 1,
      goodAt: 2,
      perfectMs: 90,
      goodMs: 130,
    },
  },
  {
    id: 'sigma-stare',
    name: 'Sigma Stare',
    emoji: '🕶️',
    kind: 'timing',
    difficulty: 2,
    durationMs: 3300,
    baseAura: 1300,
    animation: 'stare',
    qte: {
      kind: 'timing',
      game: 'sweep',
      sweepMs: 800,
      zones: 2,
      goodAt: 2,
      perfectMs: 62,
      goodMs: 92,
    },
  },
  {
    id: 'griddy-drop',
    name: 'Griddy Drop',
    emoji: '🕺',
    kind: 'timing',
    difficulty: 3,
    durationMs: 3300,
    baseAura: 2000,
    animation: 'griddy',
    qte: {
      kind: 'timing',
      game: 'sweep',
      sweepMs: 800,
      zones: 3,
      goodAt: 2,
      perfectMs: 50,
      goodMs: 76,
    },
  },

  // --- Timing: three lanes ---------------------------------------------------
  // The chart has to finish before the animation does, or its last notes are
  // charged to a player who was never shown them.
  {
    id: 'vibe-check',
    name: 'Vibe Check',
    emoji: '✨',
    kind: 'timing',
    difficulty: 1,
    durationMs: 3200,
    baseAura: 900,
    animation: 'beatDrop',
    qte: {
      kind: 'timing',
      game: 'lanes',
      lanes: 3,
      notes: 6,
      goodAt: 3,
      travelMs: 900,
      gapMs: 400,
      subdivisions: 1,
      perfectMs: 120,
      goodMs: 165,
    },
  },
  {
    id: 'beat-drop',
    name: 'Beat Drop',
    emoji: '🎵',
    kind: 'timing',
    difficulty: 2,
    durationMs: 3600,
    baseAura: 1300,
    animation: 'beatDrop',
    qte: {
      kind: 'timing',
      game: 'lanes',
      lanes: 3,
      notes: 7,
      goodAt: 4,
      travelMs: 900,
      gapMs: 400,
      subdivisions: 2,
      perfectMs: 105,
      goodMs: 150,
    },
  },
  {
    id: 'hyperpop',
    name: 'Hyperpop',
    emoji: '🎧',
    kind: 'timing',
    difficulty: 3,
    durationMs: 4000,
    baseAura: 2000,
    animation: 'hyperpop',
    qte: {
      kind: 'timing',
      game: 'lanes',
      lanes: 3,
      notes: 8,
      goodAt: 4,
      travelMs: 900,
      gapMs: 400,
      subdivisions: 4,
      perfectMs: 92,
      goodMs: 135,
    },
  },

  // --- Speed: the pads -------------------------------------------------------
  // One pad is a mash, two is a six and a seven, three has to be walked.
  {
    id: 'rizz-clap',
    name: 'Rizz Clap',
    emoji: '👏',
    kind: 'speed',
    difficulty: 1,
    durationMs: 2200,
    baseAura: 900,
    animation: 'clap',
    qte: { kind: 'speed', game: 'mash', goodAt: 7, pads: 1 },
  },
  {
    id: 'six-seven',
    name: 'Six Seven',
    emoji: '✌️',
    kind: 'speed',
    difficulty: 2,
    durationMs: 2200,
    baseAura: 1300,
    animation: 'sixSeven',
    qte: { kind: 'speed', game: 'mash', goodAt: 8, pads: 2 },
  },
  {
    id: 'sturdy',
    name: 'Sturdy',
    emoji: '🦵',
    kind: 'speed',
    difficulty: 3,
    durationMs: 2600,
    baseAura: 2000,
    animation: 'sturdy',
    qte: { kind: 'speed', game: 'mash', goodAt: 9, pads: 3 },
  },

  // --- Speed: find the numbers -----------------------------------------------
  {
    id: 'npc-mode',
    name: 'NPC Mode',
    emoji: '🤖',
    kind: 'speed',
    difficulty: 1,
    durationMs: 3200,
    baseAura: 900,
    animation: 'tierList',
    qte: { kind: 'speed', game: 'order', visible: 5, goodAt: 4 },
  },
  {
    id: 'tier-list',
    name: 'Tier List',
    emoji: '🔢',
    kind: 'speed',
    difficulty: 2,
    durationMs: 3200,
    baseAura: 1300,
    animation: 'tierList',
    qte: { kind: 'speed', game: 'order', visible: 6, goodAt: 5 },
  },
  {
    id: 'speedrun',
    name: 'Speedrun',
    emoji: '⏱️',
    kind: 'speed',
    difficulty: 3,
    durationMs: 3400,
    baseAura: 2000,
    animation: 'speedrun',
    qte: { kind: 'speed', game: 'order', visible: 7, goodAt: 6 },
  },

  // --- Control: hold the ring ------------------------------------------------
  {
    id: 'lean',
    name: 'Lean',
    emoji: '🫠',
    kind: 'control',
    difficulty: 1,
    durationMs: 1900,
    baseAura: 900,
    animation: 'lean',
    qte: {
      kind: 'control',
      game: 'zone',
      zoneRadius: 0.22,
      driftSpeed: 0.7,
      perfectRatio: 0.85,
      goodRatio: 0.5,
    },
  },
  {
    id: 'locked-in',
    name: 'Locked In',
    emoji: '🔒',
    kind: 'control',
    difficulty: 2,
    durationMs: 1900,
    baseAura: 1300,
    animation: 'lockedIn',
    qte: {
      kind: 'control',
      game: 'zone',
      zoneRadius: 0.16,
      driftSpeed: 0.7,
      perfectRatio: 0.85,
      goodRatio: 0.5,
    },
  },
  {
    id: 'levitate',
    name: 'Levitate',
    emoji: '🧘',
    kind: 'control',
    difficulty: 3,
    durationMs: 2050,
    baseAura: 2000,
    animation: 'levitate',
    qte: {
      kind: 'control',
      game: 'zone',
      zoneRadius: 0.12,
      driftSpeed: 0.7,
      perfectRatio: 0.85,
      goodRatio: 0.55,
    },
  },

  // --- Control: two fingers, two paths ---------------------------------------
  // Roughly one full bend per card at these speeds: enough to have to steer,
  // not so much that it turns into a blur.
  {
    id: 'cruise-control',
    name: 'Cruise Control',
    emoji: '🚗',
    kind: 'control',
    difficulty: 1,
    durationMs: 2300,
    baseAura: 900,
    animation: 'splitFocus',
    qte: {
      kind: 'control',
      game: 'paths',
      laneWidth: 0.24,
      wander: 0.3,
      speed: 1.5,
      perfectRatio: 0.8,
      goodRatio: 0.5,
    },
  },
  {
    id: 'split-focus',
    name: 'Split Focus',
    emoji: '🤞',
    kind: 'control',
    difficulty: 2,
    durationMs: 2300,
    baseAura: 1300,
    animation: 'splitFocus',
    qte: {
      kind: 'control',
      game: 'paths',
      laneWidth: 0.175,
      wander: 0.32,
      speed: 1.5,
      perfectRatio: 0.8,
      goodRatio: 0.5,
    },
  },
  {
    id: 'galaxy-brain',
    name: 'Galaxy Brain',
    emoji: '🧠',
    kind: 'control',
    difficulty: 3,
    durationMs: 2700,
    baseAura: 2000,
    animation: 'galaxyBrain',
    qte: {
      kind: 'control',
      game: 'paths',
      laneWidth: 0.135,
      wander: 0.34,
      speed: 1.5,
      perfectRatio: 0.85,
      goodRatio: 0.55,
    },
  },
]

const BY_ID = new Map(CARDS.map((c) => [c.id, c]))

export function getCard(id: string): Card {
  const card = BY_ID.get(id)
  if (!card) throw new Error(`Unknown card: ${id}`)
  return card
}

export const ALL_CARD_IDS: readonly string[] = CARDS.map((c) => c.id)

/**
 * What you own before you have beaten anybody: the three NORMAL cards of each
 * kind. The split is the difficulty already on the card rather than a second
 * list to keep in step — every kind holds three NORMAL and two HARD, so
 * "starter" and "locked" are one predicate, not fifteen decisions.
 */
export function isStarter(card: Card): boolean {
  return card.difficulty < 3
}

export const STARTER_CARD_IDS: readonly string[] = CARDS.filter(isStarter).map((c) => c.id)
export const LOCKED_CARD_IDS: readonly string[] = CARDS.filter((c) => !isStarter(c)).map(
  (c) => c.id,
)

/**
 * How hard a card is, in words. Stars implied a scale that starts at one, and
 * the pool has not had a one-star card since the easy tier was cut.
 */
export const TIER_LABEL: Record<Difficulty, string> = {
  1: 'EASY',
  2: 'NORMAL',
  3: 'HARD',
}

export const KIND_LABEL: Record<QteKind, string> = {
  timing: '🎯 Timing',
  speed: '⚡ Speed',
  control: '🧠 Control',
}
