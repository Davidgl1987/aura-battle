import { INTRO_MS, STREAK_MIN } from '../engine/balance'
import { getCard } from '../engine/cards'
import type { Judgement, MatchState, PlayerId, TurnResult } from '../engine/types'

/**
 * What a turn is worth showing a body about. The four judgements, and the three
 * things that can happen on top of one and are worth more than it: a meter
 * filled, a rival out-scored, a run of PERFECTs.
 *
 * Bigger than `Judgement` on purpose. A PERFECT that lights GOD AURA is the
 * loudest moment the game has and it used to look exactly like any other
 * PERFECT, because the only thing the stage was told was the grade.
 */
export type Beat =
  | Judgement
  | 'LOST_COMPOSURE'
  | 'GOD_AURA'
  | 'OUTAURA'
  | 'STREAK'

/** What a fighter is doing right now, and since when. */
export type FighterAction =
  /**
   * Nothing is being asked of them. Not the absence of an animation: the
   * resting clip is under every frame of every action, and idling is what is
   * left when nothing is playing over it. See `clipPlayer.ts`.
   */
  | { kind: 'idle' }
  | { kind: 'windUp'; startedAt: number; durationMs: number }
  | { kind: 'move'; animation: string; startedAt: number; durationMs: number }
  | {
      kind: 'react'
      beat: Beat
      startedAt: number
      durationMs: number
    }
  /** The battle is over. Loops on wall time, so it never runs out. */
  | { kind: 'finale'; won: boolean }
  /** The other one, reacting to what just happened across the stage. */
  | {
      kind: 'watch'
      beat: Beat
      startedAt: number
      durationMs: number
    }

/**
 * What a result is worth showing, which is not always the grade it was given.
 *
 * Read most spectacular first, because a play can be several of these at once
 * and the body only has one thing to say: lighting GOD AURA outranks the
 * OUTAURA that came with it, which outranks the streak, which outranks the
 * PERFECT underneath all three. Everything here is already on the result — the
 * stage works out what it means, it does not ask the engine for anything new.
 */
export function beatOf(result: TurnResult): Beat {
  if (!result.godAuraBefore && result.godAuraAfter) return 'GOD_AURA'
  if (result.lines.some((line) => line.key === 'outaurad')) return 'OUTAURA'
  if (result.perfectStreak >= STREAK_MIN) return 'STREAK'
  return result.judgement
}

/**
 * Where a fighter can stand. The first two are the battle; the rest are for
 * showing them off on the title and while a deck is being built.
 */
export type Slot =
  | 'front'
  | 'back'
  | 'showLeft'
  | 'showRight'
  | 'showCentre'
  | 'ring0'
  | 'ring1'
  | 'ring2'
  | 'ring3'

/** How long a reaction takes to play before it settles into a hold. */
export const REACTION_MS = 900

/**
 * Reads the match and says what each body should be doing. Pure, so the
 * staging can be checked without a canvas: whoever is up is out front, and
 * only they perform.
 */
export function fighterAction(match: MatchState, playerId: PlayerId): FighterAction {
  const phase = match.phase

  switch (phase.kind) {
    case 'performIntro':
      // Timed phases only record when they end, so the start is worked back.
      return playerId === match.active
        ? { kind: 'windUp', startedAt: phase.endsAt - INTRO_MS, durationMs: INTRO_MS }
        : IDLE

    case 'qte': {
      if (playerId !== match.active) return IDLE
      const card = getCard(phase.cardId)
      return {
        kind: 'move',
        animation: card.animation,
        startedAt: phase.startedAt,
        durationMs: card.durationMs,
      }
    }

    case 'resolve':
    case 'lostComposure':
      return {
        // Both bodies have something to say about a result: one owns it, the
        // other answers it.
        kind: playerId === phase.result.player ? 'react' : 'watch',
        beat: beatOf(phase.result),
        startedAt: phase.startedAt,
        // The reaction plays out, then holds for as long as the score is up.
        durationMs: REACTION_MS,
      }

    case 'matchEnd':
      // A draw leaves nobody to celebrate, so both just stand there.
      return phase.winner === null
        ? IDLE
        : { kind: 'finale', won: phase.winner === playerId }

    default:
      return IDLE
  }
}

const IDLE: FighterAction = { kind: 'idle' }

/**
 * How far apart the two fighters' resting loops are held. A little over a
 * second: long enough that no phrase of the eight-second idle lines up, short
 * enough that both are still visibly breathing rather than one being caught
 * mid-hold. A property of who is standing where, not of what they are doing,
 * which is why it rides on the body rather than on the action.
 */
export const REST_STAGGER_MS = 1300

/** Whoever is up steps forward; the other waits upstage. */
export function slotOf(match: MatchState, playerId: PlayerId): Slot {
  if (match.phase.kind === 'matchEnd' && match.phase.winner !== null) {
    return match.phase.winner === playerId ? 'front' : 'back'
  }
  return playerId === match.active ? 'front' : 'back'
}

/*
 * A phone held upright sees a tall, narrow slice of the world, so the two
 * fighters are separated by depth rather than by standing side by side — at
 * the old spacing the rival fell straight off the edge of the frame.
 */
/**
 * How far out the title's four stand from the middle of the floor. Sized for
 * arms, not shoulders: a gesture reaches well past the body, and at 1.35 the
 * outermost fighter kept losing a hand off the edge of a portrait screen.
 */
const RING_RADIUS = 1.2

/**
 * Four marks evenly around a ring, each turned to face away from the middle.
 * The camera orbits outside them, so whoever it is passing is looking straight
 * down the lens while the rest are caught mid-gesture.
 */
function ringMarks() {
  const marks = {} as Record<'ring0' | 'ring1' | 'ring2' | 'ring3', (typeof SLOTS)['front']>
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2
    marks[`ring${i}` as keyof typeof marks] = {
      x: Math.sin(angle) * RING_RADIUS,
      z: Math.cos(angle) * RING_RADIUS,
      turn: angle,
      scale: 1,
    }
  }
  return marks
}

export const SLOTS: Record<Slot, { x: number; z: number; turn: number; scale: number }> = {
  front: { x: 0, z: 0.25, turn: 0, scale: 1 },
  back: { x: 1.05, z: -2.5, turn: -0.4, scale: 1 },
  // A phone in portrait only sees about 1.4 units either side of the middle,
  // so anything further out is standing off the edge of the picture.
  showLeft: { x: -1.02, z: -0.7, turn: 0.42, scale: 1 },
  showRight: { x: 1.02, z: -0.7, turn: -0.42, scale: 1 },
  showCentre: { x: 0, z: 0.3, turn: 0, scale: 1 },
  ...ringMarks(),
}

/**
 * How far into an action we are, 0 to 1. Idling and the finale have nowhere to
 * be: they loop on wall time instead of running out.
 */
export function actionProgress(action: FighterAction, now: number): number {
  if (action.kind === 'idle' || action.kind === 'finale') return 0
  return Math.min(1, Math.max(0, (now - action.startedAt) / action.durationMs))
}
