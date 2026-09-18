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
 * same as it was worth before they existed. Which game a card runs is a
 * question about the gesture rather than about the tier — the clap is a mash,
 * the driving one steers two lanes, the ranking one presses numbers in order —
 * and `docs/qte.md` lists all six alongside what they ask a thumb to do.
 *
 * `durationMs` is the animation and the QTE at once: the stage performs the
 * card's clip over exactly this long and the gesture is graded over exactly
 * this long, so the number is the length of one action rather than of two that
 * happen to overlap. It is therefore read off the clip — `BLEND_IN_MS` plus
 * whatever stretch of the file `clips.ts` plays — and never rounded up to make
 * a card harder. A card longer than its own clip stands there breathing
 * through the end of its own move, which `clips.test.ts` now fails on. Shorter
 * is allowed and sometimes necessary: a hold has a ceiling of its own.
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
    durationMs: 3050,
    baseAura: 900,
    // Preening. The gesture itself is not in the pack — see docs/firetoy.md.
    // 3050 is all `being-cocky` has, blend in front of it included. At 3300 the
    // preen was over a quarter of a second before the card was, and the fighter
    // stood there breathing through the end of their own move.
    animation: 'being-cocky',
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
    // A head scanning the room until it locks onto you.
    animation: 'looking',
    qte: {
      kind: 'timing',
      game: 'sweep',
      sweepMs: 800,
      zones: 2,
      goodAt: 4,
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
    // Footwork, and short enough to come round twice.
    animation: 'bboy-hip-hop-move',
    qte: {
      kind: 'timing',
      game: 'sweep',
      sweepMs: 800,
      zones: 3,
      goodAt: 6,
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
    // The easiest groove in the pack, arms wide open.
    animation: 'hip-hop-dancing',
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
    durationMs: 3800,
    baseAura: 1300,
    // The horse, all of it: 3.63 seconds and the blend in front of it. At 3600
    // the card ended on the second-to-last beat of the clip. The chart still
    // finishes first, by design — see `notesInside` — so the last note lands
    // and the gesture gets to close over the top of it.
    animation: 'gangnam-style',
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
    // The fastest and least dignified thing here.
    animation: 'silly-dancing',
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
    durationMs: 2380,
    baseAura: 900,
    // Arms snapping together in front, on a loop — and 2380 is exactly one
    // turn of it once the blend is paid for. At 2200 the card stopped a sixth
    // of a second short of the cycle, mid-clap.
    animation: 'bboy-hip-hop-move',
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
    // Hands alternating. Not the count itself — see docs/firetoy.md.
    animation: 'hokey-pokey',
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
    // Kicks out to the side, which is what the card is.
    animation: 'swing-dancing',
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
    // One second of glide, three times over, expressionless.
    animation: 'moonwalk',
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
    // Appraising something invisible, the way the stare does.
    animation: 'looking',
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
    // The hardest speed card gets the only flip in the pack.
    animation: 'backflip',
    qte: { kind: 'speed', game: 'order', visible: 7, goodAt: 6 },
  },

  // --- Control: hold the ring ------------------------------------------------
  // All three run 2100 ms, which is the longest a single finger is asked to
  // track anything — `control.test.ts` holds the line, because the window runs
  // from the touch that armed the QTE and a hold that outstays it stops being
  // a test and starts being a chore.
  //
  // The same length for all three on purpose: the tier is the ring and nothing
  // else. Smaller *and* longer would be doing the difficulty twice, which is
  // the mistake `QTE_RAMP` was flattened to undo. They were 1900 / 1900 / 2050,
  // which cut all three clips off around halfway; the cap is the most of them
  // a hold can show.
  {
    id: 'lean',
    // Was "Lean", named for a pose that tipped the whole body over. The clip
    // that replaced it is a small fists-up shimmy that never leaves the
    // vertical, and the ring it is played over is the big easy one — small,
    // contained, no pressure. The id stays: it is in every saved deck.
    name: 'Lowkey',
    emoji: '🫠',
    kind: 'control',
    difficulty: 1,
    durationMs: 2100,
    baseAura: 900,
    // Loose enough to tip over. `silly-dancing` runs nearly four seconds and a
    // hold cannot, so this shows the opening of it and blends out. A window of
    // its own would fit better — it is Hyperpop's clip too, and Hyperpop plays
    // every frame of it, so the window would have to be a second entry.
    animation: 'silly-dancing',
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
    durationMs: 2100,
    baseAura: 1300,
    // Contained. Almost nothing moves, which is the point.
    animation: 'being-cocky',
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
    // Was "Levitate", from a pose that hovered. Nothing in the pack leaves the
    // ground — see docs/firetoy.md — and what plays here is an arms-open groove
    // with the feet planted, held over the smallest ring in the game. Staying
    // in it is the card, so the name says that instead of promising a float.
    // The id stays: it is a rival's signature and a saved unlock.
    name: 'Flow State',
    emoji: '🧘',
    kind: 'control',
    difficulty: 3,
    durationMs: 2100,
    baseAura: 2000,
    // Arms open, turning. Nothing in the pack leaves the ground.
    animation: 'hip-hop-dancing',
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
    // Was "Cruise Control". The window of `dancing-twerk` it performs is a low,
    // wide squat bouncing on the spot, and the gesture is two thumbs on two
    // wheels — a car that bounces is the one this looks like. The id stays: it
    // is a starter card and in the default deck.
    name: 'Low Rider',
    emoji: '🚗',
    kind: 'control',
    difficulty: 1,
    durationMs: 2480,
    baseAura: 900,
    // Settled low with both hands out front. 2480 is the whole of the window
    // `dancing-twerk` is given, blend included; at 2300 the steer outlasted
    // the hands it was supposed to belong to by a fifth of a second.
    animation: 'dancing-twerk',
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
    // Two arms doing two different things.
    animation: 'hokey-pokey',
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
    // Arms up and rising, which is the two thirds of it that fits. The rest
    // needs 3.8 seconds, and a two-thumbed trace that long is a chore rather
    // than a card — the lane is what makes this the hard one, not the clock.
    // Beat Drop plays the same clip in full, so the move is not going unseen.
    animation: 'gangnam-style',
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
