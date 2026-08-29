import type { Difficulty, Freshness, Judgement, MatchSettings } from './types'

/**
 * Every tunable number lives here so the whole game can be re-balanced from a
 * single file (and, in dev, from the leva panel).
 */

// --- Pacing -----------------------------------------------------------------
/** Camera move onto the active character before the QTE starts. */
export const INTRO_MS = 400
/**
 * Slack between the QTE ending for the player and the reducer calling it a
 * MISS. The widget owns the real window and always reports first; this is only
 * the safety net for a widget that never answers.
 */
export const QTE_GRACE_MS = 250
/**
 * How long a QTE waits for the player's first touch before starting anyway.
 * Nobody who is actually playing gets near it — it only exists so refusing to
 * touch cannot stall the battle forever.
 */
export const QTE_ARM_MS = 2500

// --- Match ------------------------------------------------------------------
/** Cards each player brings. Their deck is their hand: no drawing, no refills. */
export const DECK_SIZE_MIN = 4
export const DECK_SIZE_MAX = 6
export const DECK_SIZE_DEFAULT = 4

/** Seconds on the clock to pick a card. */
export const CHOOSE_SECONDS_MIN = 3
export const CHOOSE_SECONDS_MAX = 5
export const CHOOSE_SECONDS_DEFAULT = 4

/**
 * The aura bar runs from one player's end to the other's, and reaching an end
 * is the instant win. One number, not two: the bar filling up IS the MOGGED
 * condition, so the win rule explains itself by being watched.
 *
 * It was 6000, and at 6000 a beating was over before anyone caught fire: half
 * of one-sided battles ended without god aura appearing at all. Aura races to
 * its threshold faster than momentum races to its cap, so the aura threshold
 * is the one that had to move.
 *
 * It then had to move again, from 7000, when the one-star cards were cut: the
 * median play went from 1600 to 1900, and this number is only ever meaningful
 * as a multiple of what a play is worth. Anything that changes the card pool
 * changes this too.
 *
 * And again, from 8000, when gestures started being scored over their whole
 * length. A play is worth what the card is worth times how much of it was
 * landed, and a run that goes past the bar is worth more still — the median
 * went half again, so this had to as well or a battle was over in three moves.
 */
export const MOGGED_THRESHOLD = 13000

/**
 * How hard the bar leans toward whoever is ahead. The needle is a curve, not a
 * ratio, so a lead reads as domination before it is mathematically decisive: a
 * quarter of the winning gap already pushes it a third of the way over.
 *
 * Lower exaggerates harder. Below about 0.7 a single strong opening move sends
 * the bar past 80%, which reads as "already won" on move one rather than as
 * momentum.
 */
export const BAR_CURVE = 0.75

export const DEFAULT_SETTINGS: MatchSettings = {
  deckSize: DECK_SIZE_DEFAULT,
  chooseMs: CHOOSE_SECONDS_DEFAULT * 1000,
}

// --- The gesture ------------------------------------------------------------
/**
 * A gesture is scored over its whole length rather than at one moment. These
 * are the numbers that shape the run; `engine/qte.ts` is what applies them.
 */

/**
 * How often a continuous gesture is sampled. Fixed rather than per frame: a
 * phone at 30fps and one at 60 must score the same hold identically.
 */
export const QTE_TICK_MS = 250

/**
 * The band every card's opportunity count is held inside.
 *
 * PERFECT is a run with no fumbles in it, so a card offering twice as many
 * chances is twice as likely to lose one — which would be a systematic penalty
 * for nothing but being longer. Cards differ by how hard each chance is, not
 * by how many there are.
 */
export const QTE_OPPORTUNITIES_MIN = 6
export const QTE_OPPORTUNITIES_MAX = 8

/**
 * How far past "enough" an open-ended gesture can still pay.
 *
 * The sweep, the mash and the number run have no number they stop at — you
 * keep going for the whole animation and the extras keep scoring. Uncapped,
 * that would hand those three a permanent edge over the three that end when
 * their chart does, which is the one thing the normalisation exists to stop.
 */
export const QTE_OVERSHOOT_MAX = 1.25

/** What a landed-but-scrappy opportunity is worth against a clean one. */
export const QTE_SCRAPPY_VALUE = 0.55

/**
 * What one fumble costs, in opportunities. At 1 a mistake cancels a clean hit,
 * so a run that had cleared the threshold can be dragged back under it — which
 * is the point: the bar is not a checkpoint you keep once you have passed it.
 */
export const QTE_MISTAKE_COST = 1

/**
 * What clearing the bar means, as a share of it. Kept at 1: the bar a card
 * names in `goodAt` is the bar, and a run either got there or did not.
 */
export const QTE_GOOD_RATIO = 1

/**
 * How much harder a card is by its last opportunity than by its first. A run
 * that starts comfortable and ends flat out is what separates two players who
 * would both have cleared a single threshold.
 */
export const QTE_RAMP = 1.5

/**
 * How much better or worse than usual one card can go.
 *
 * Averaging six or eight opportunities is what makes a gesture a test of a run
 * rather than of one instant — but it also takes nearly all the luck out of a
 * card, and a game with no luck in it has a ladder you cannot tune: between
 * two rivals nine points of skill apart the win rate fell sixty. This puts the
 * swing back where it belongs, on the card rather than on the beat. Some
 * gestures just go badly.
 */
export const QTE_FORM_SWING = 0.7

/**
 * Paid on top of a clean run. Moderate on purpose: the accuracy is already the
 * reward, and a large flat bonus would make the difference between PERFECT and
 * GOOD a cliff again rather than the top of a slope.
 */
export const PERFECT_BONUS = 350

// --- Aura -------------------------------------------------------------------
/**
 * Aura is scored as a bill, not a formula: a base line for the execution, flat
 * bonuses for the things worth celebrating, and one multiplier at the bottom.
 * Everything a player is shown adds up, which is what lets the resolve screen
 * show its own arithmetic.
 */
/** A MISS costs this share of the card's base aura. */
export const MISS_PENALTY = 0.35
/** Base lines land on a multiple of this, so no score ends in stray digits. */
export const AURA_ROUNDING = 50

/** Answering with a kind the rival did not just play. */
export const FRESH_AURA = 400
/**
 * Landing a card that could have gone wrong. Nothing for the easy ones.
 *
 * The hard tier had to go up when gestures started being scored over their
 * whole length: a hard card is now landed less *cleanly* as well as less
 * often, so at 400 a good player was better off never bringing one — which
 * would have made the whole difficulty axis decoration.
 */
export const HARD_AURA: Record<Difficulty, number> = { 1: 0, 2: 250, 3: 1300 }

/** Consecutive PERFECTs needed before the streak is worth anything. */
export const STREAK_MIN = 2
/** Streak pays `BASE + STEP * (streak - STREAK_MIN)`, up to MAX. */
export const STREAK_AURA_BASE = 200
export const STREAK_AURA_STEP = 150
export const STREAK_AURA_MAX = 800

/**
 * Beat the impact of the rival's last landed play by this much to have
 * OUTAURA'D them.
 */
export const OUTAURA_RATIO = 1.5
/**
 * What out-scoring them is worth. Not aura: the play has already earned half
 * again what theirs did, and paying a bonus on top of that paid twice for the
 * same thing. Momentum instead, so the reward is a step toward god aura.
 */
export const OUTAURA_MOMENTUM = 1

/** Aura multiplier while GOD AURA is active. Whole bill, not just the base. */
export const GOD_AURA_MULT = 2

// --- Momentum ---------------------------------------------------------------
/**
 * Momentum has four sources on purpose. Varying used to be the only one that
 * mattered, which made reading the rival the entire game; now execution,
 * difficulty and streaks each carry a share, and repeating is the only thing
 * that actively drains it.
 */
export const MOMENTUM_MAX = 100
export const MOMENTUM_JUDGE: Record<Judgement, number> = {
  PERFECT: 19,
  GOOD: 8,
  MISS: -30,
}
export const MOMENTUM_FRESH: Record<Freshness, number> = {
  FRESH: 12,
  NEUTRAL: -4,
  STALE: -16,
}
export const MOMENTUM_HARD: Record<Difficulty, number> = { 1: 0, 2: 4, 3: 9 }
export const MOMENTUM_STREAK_STEP = 4
export const MOMENTUM_STREAK_MAX = 16
/** Momentum you drop to when a MISS breaks GOD AURA. */
export const GOD_AURA_BREAK = 55

// --- Solo -------------------------------------------------------------------
/**
 * Solo runs one format for every rival. Aura objectives are the reason: a
 * player's total is driven far more by how many cards they get to play than by
 * who they played against — the measured median moves 5,350 / 6,600 / 7,950
 * across decks of 4, 5 and 6 — so a "get 8,000 aura" goal set against a
 * variable deck size would mean something different every battle.
 */
export const SOLO_DECK_SIZE = 5

export const SOLO_SETTINGS: MatchSettings = {
  deckSize: SOLO_DECK_SIZE,
  chooseMs: CHOOSE_SECONDS_DEFAULT * 1000,
}

// --- CPU --------------------------------------------------------------------
/**
 * How a card's difficulty bends the odds of the player answering it. A
 * profile's numbers describe a difficulty-2 card; harder cards punish and
 * easier ones forgive, which is what makes bringing one a real decision.
 *
 * These were the simulator's, and they moved here when the CPU started using
 * them: the odds that balance the game and the odds a rival actually plays to
 * have to be the same numbers, or the ladder is measured against a fiction.
 */
export const PERFECT_SCALE: Record<Difficulty, number> = { 1: 1.25, 2: 1, 3: 0.72 }
export const MISS_SCALE: Record<Difficulty, number> = { 1: 0.5, 2: 1, 3: 1.8 }

/** The best a `qteSkill` of 1 is allowed to be: nobody is perfect every time. */
export const CPU_PERFECT_CEILING = 0.95
/**
 * What is left over after PERFECT splits into GOOD and MISS on `consistency`.
 * A rival at 0 keeps a third of the remainder; at 1, nearly all of it.
 */
export const CPU_GOOD_FLOOR = 0.35
export const CPU_GOOD_SPAN = 0.55

/**
 * How far past the bar an open-ended gesture is played, from the slowest hands
 * to the quickest.
 *
 * Comfortably over 1 even at the bottom, because you have to keep going past
 * the bar for a fumble to be absorbable at all — stopping the moment you clear
 * it means the next mistake drops you straight back under. That is the rule
 * working as intended, but a rival that stopped at the bar could only ever
 * come out PERFECT or MISS, with no GOOD in between.
 */
export const CPU_PACE_FLOOR = 0.55
export const CPU_PACE_SPAN = 1.5

/**
 * The fewest chances past the bar an open gesture is ever played for.
 *
 * A low bar is not a short gesture — a two-centre sweep still runs the whole
 * animation — so pacing off the bar alone had a rival stop after two taps of a
 * card that came past five times, and made the low-bar cards far harsher than
 * the rest for no reason a player would recognise.
 */
export const CPU_OPEN_HEADROOM = 3

/**
 * How much likelier a rival is to fumble a gesture that tests aim than one
 * that tests order.
 *
 * On the mash and the number run a mistake is a slip — the same hand twice, a
 * number out of turn — and a player who is paying attention rarely makes one
 * however long they keep going. On the sweep, the chart and the ring every
 * chance is a fresh test of aim. Modelling all six the same way made a long
 * clean run impossible for reasons that have nothing to do with playing them.
 */
export const CPU_SLIP_SCALE = 0.22

/** How long a rival appears to think before committing to a card. */
export const CPU_THINK_MIN_MS = 600
export const CPU_THINK_MAX_MS = 1400
/** How long a rival leaves its own score sheet up before handing back over. */
export const CPU_READ_MS = 1500
