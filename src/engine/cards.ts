import type { Card, Difficulty, QteKind } from './types'

/**
 * The card pool: 15 cards — five of each kind, and every kind holds the same
 * spread of three NORMAL and two HARD. Each player builds a
 * deck of 4 to 6 of these before the battle; both may pick the same card.
 *
 * `kind` is what freshness is measured on, and it stays at three. `game` is the
 * minigame the card actually runs, and there are two of those per kind: adding
 * minigames without adding kinds is what keeps varying your answers worth the
 * same as it was worth before they existed.
 *
 * Nothing here is an easy card any more. That tier was cut on purpose; MEWING
 * and SIX SEVEN survived it as recognisable moves and were pulled up to NORMAL
 * to do it.
 */
export const CARDS: readonly Card[] = [
  // --- Timing ---------------------------------------------------------------
  {
    id: 'mewing',
    name: 'Mewing',
    emoji: '😤',
    kind: 'timing',
    difficulty: 2,
    durationMs: 2450,
    baseAura: 1300,
    animation: 'mewing',
    qte: { kind: 'timing', game: 'sweep', sweepMs: 950, hits: 2, perfectMs: 62, goodMs: 145 },
  },
  {
    id: 'sigma-stare',
    name: 'Sigma Stare',
    emoji: '🕶️',
    kind: 'timing',
    difficulty: 2,
    durationMs: 2450,
    baseAura: 1300,
    animation: 'stare',
    qte: { kind: 'timing', game: 'sweep', sweepMs: 800, hits: 2, perfectMs: 55, goodMs: 130 },
  },
  {
    id: 'griddy-drop',
    name: 'Griddy Drop',
    emoji: '🕺',
    kind: 'timing',
    difficulty: 3,
    durationMs: 2850,
    baseAura: 2000,
    animation: 'griddy',
    qte: { kind: 'timing', game: 'sweep', sweepMs: 600, hits: 3, perfectMs: 45, goodMs: 105 },
  },

  // --- Timing: three lanes ---------------------------------------------------
  {
    id: 'beat-drop',
    name: 'Beat Drop',
    emoji: '🎵',
    kind: 'timing',
    difficulty: 2,
    durationMs: 2900,
    baseAura: 1300,
    animation: 'beatDrop',
    qte: {
      kind: 'timing',
      game: 'lanes',
      lanes: 3,
      notes: 5,
      travelMs: 950,
      gapMs: 430,
      perfectMs: 75,
      goodMs: 165,
    },
  },
  {
    id: 'hyperpop',
    name: 'Hyperpop',
    emoji: '🎧',
    kind: 'timing',
    difficulty: 3,
    durationMs: 3000,
    baseAura: 2000,
    animation: 'hyperpop',
    qte: {
      kind: 'timing',
      game: 'lanes',
      lanes: 3,
      notes: 7,
      travelMs: 780,
      gapMs: 340,
      perfectMs: 55,
      goodMs: 125,
    },
  },

  // --- Speed ----------------------------------------------------------------
  {
    id: 'six-seven',
    name: 'Six Seven',
    emoji: '✌️',
    kind: 'speed',
    difficulty: 2,
    durationMs: 2200,
    baseAura: 1300,
    animation: 'sixSeven',
    // Two pads: the gesture is a six and a seven, one in each hand, so the
    // card asks for both thumbs the way the move does.
    qte: { kind: 'speed', game: 'mash', targetTaps: 16, alternating: true },
  },
  {
    id: 'rizz-clap',
    name: 'Rizz Clap',
    emoji: '👏',
    kind: 'speed',
    difficulty: 2,
    durationMs: 2350,
    baseAura: 1300,
    animation: 'clap',
    qte: { kind: 'speed', game: 'mash', targetTaps: 18, alternating: true },
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
    qte: { kind: 'speed', game: 'mash', targetTaps: 29, alternating: true },
  },

  // --- Speed: find them in order ---------------------------------------------
  {
    id: 'tier-list',
    name: 'Tier List',
    emoji: '🔢',
    kind: 'speed',
    difficulty: 2,
    durationMs: 3200,
    baseAura: 1300,
    animation: 'tierList',
    // `goodMs` sits at the card's own length, so simply finishing is a GOOD and
    // only pressing the wrong number can drag it below that.
    qte: { kind: 'speed', game: 'order', count: 5, perfectMs: 2000, goodMs: 3200, mistakeMs: 450 },
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
    qte: { kind: 'speed', game: 'order', count: 6, perfectMs: 2100, goodMs: 3400, mistakeMs: 500 },
  },

  // --- Control --------------------------------------------------------------
  {
    id: 'lean',
    name: 'Lean',
    emoji: '🫠',
    kind: 'control',
    difficulty: 2,
    durationMs: 1680,
    baseAura: 1300,
    animation: 'lean',
    qte: { kind: 'control', game: 'zone', zoneRadius: 0.15, driftSpeed: 0.7, perfectRatio: 0.85, goodRatio: 0.5 },
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
    qte: { kind: 'control', game: 'zone', zoneRadius: 0.12, driftSpeed: 0.85, perfectRatio: 0.85, goodRatio: 0.55 },
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
      zoneRadius: 0.17,
      driftSpeed: 0.6,
      perfectRatio: 0.82,
      goodRatio: 0.5,
    },
  },

  // --- Control: two fingers, two paths ---------------------------------------
  {
    id: 'split-focus',
    name: 'Split Focus',
    emoji: '🤞',
    kind: 'control',
    difficulty: 2,
    durationMs: 2300,
    baseAura: 1300,
    animation: 'splitFocus',
    // Roughly one full bend per card at this speed: enough to have to steer,
    // not so much that it turns into a blur.
    qte: {
      kind: 'control',
      game: 'paths',
      laneWidth: 0.17,
      wander: 0.32,
      speed: 1.6,
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
      laneWidth: 0.115,
      wander: 0.36,
      speed: 2.3,
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
