import { INTRO_MS } from '../engine/balance'
import { getCard } from '../engine/cards'
import type { Judgement, MatchState, PlayerId } from '../engine/types'

/** What a fighter is doing right now, and since when. */
export type FighterAction =
  | { kind: 'idle' }
  | { kind: 'windUp'; startedAt: number; durationMs: number }
  | { kind: 'move'; animation: string; startedAt: number; durationMs: number }
  | {
      kind: 'react'
      judgement: Judgement | 'LOST_COMPOSURE'
      startedAt: number
      durationMs: number
    }
  /** The battle is over. Loops on wall time, so it never runs out. */
  | { kind: 'finale'; won: boolean }
  /** The other one, reacting to what just happened across the stage. */
  | {
      kind: 'watch'
      judgement: Judgement | 'LOST_COMPOSURE'
      startedAt: number
      durationMs: number
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
        : { kind: 'idle' }

    case 'qte': {
      if (playerId !== match.active) return { kind: 'idle' }
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
        judgement: phase.result.judgement,
        startedAt: phase.startedAt,
        // The reaction plays out, then holds for as long as the score is up.
        durationMs: REACTION_MS,
      }

    case 'matchEnd':
      // A draw leaves nobody to celebrate, so both just stand there.
      return phase.winner === null
        ? { kind: 'idle' }
        : { kind: 'finale', won: phase.winner === playerId }

    default:
      return { kind: 'idle' }
  }
}

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
