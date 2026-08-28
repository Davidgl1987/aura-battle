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
 */
export const MOGGED_THRESHOLD = 8000

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

// --- Aura -------------------------------------------------------------------
/**
 * Aura is scored as a bill, not a formula: a base line for the execution, flat
 * bonuses for the things worth celebrating, and one multiplier at the bottom.
 * Everything a player is shown adds up, which is what lets the resolve screen
 * show its own arithmetic.
 */
export const JUDGE_MULT: Record<Exclude<Judgement, 'MISS'>, number> = {
  PERFECT: 1,
  GOOD: 0.55,
}
/** A MISS costs this share of the card's base aura. */
export const MISS_PENALTY = 0.35
/** Base lines land on a multiple of this, so no score ends in stray digits. */
export const AURA_ROUNDING = 50

/** Answering with a kind the rival did not just play. */
export const FRESH_AURA = 400
/** Landing a card that could have gone wrong. Nothing for the easy ones. */
export const HARD_AURA: Record<Difficulty, number> = { 1: 0, 2: 200, 3: 400 }

/** Consecutive PERFECTs needed before the streak is worth anything. */
export const STREAK_MIN = 2
/** Streak pays `BASE + STEP * (streak - STREAK_MIN)`, up to MAX. */
export const STREAK_AURA_BASE = 200
export const STREAK_AURA_STEP = 150
export const STREAK_AURA_MAX = 800

/** Beat the rival's last play by this much to have OUTAURA'D them. */
export const OUTAURA_RATIO = 1.5
export const OUTAURA_BONUS = 300

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

/** How long a rival appears to think before committing to a card. */
export const CPU_THINK_MIN_MS = 600
export const CPU_THINK_MAX_MS = 1400
/** How long a rival leaves its own score sheet up before handing back over. */
export const CPU_READ_MS = 1500
