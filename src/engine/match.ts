import {
  AURA_ROUNDING,
  INTRO_MS,
  MOGGED_THRESHOLD,
  OUTAURA_RATIO,
  QTE_ARM_MS,
  QTE_GRACE_MS,
} from './balance'
import { ALL_CARD_IDS, getCard } from './cards'
import { CHARACTERS } from './characters'
import { nextRandom } from './rng'
import type { Play } from './scoring'
import { applyMomentum, clamp, freshnessOf, scorePlay, streakOf } from './scoring'
import type {
  Action,
  Card,
  GameEvent,
  Judgement,
  MatchSettings,
  MatchState,
  PlayerId,
  PlayerSetup,
  PlayerState,
  TurnResult,
} from './types'

/**
 * The whole match is a pure reducer: `step(state, action)`. It never reads the
 * clock — every action carries `now` — so matches are deterministic and can be
 * driven from tests with fake timestamps.
 *
 * A player's deck is their hand: everything they brought is on the table from
 * the first turn, a card is gone the moment it is played, and the battle runs
 * for a fixed number of moves each rather than until the cards run out.
 */

/**
 * How long the reducer waits before calling an unanswered QTE a MISS. It has
 * to cover the wait for the player's first touch as well as the card itself:
 * the widget's clock does not start until a finger lands.
 */
export function qteWindow(cardId: string): number {
  return QTE_ARM_MS + getCard(cardId).durationMs + QTE_GRACE_MS
}

export function defaultSetup(id: PlayerId, settings: MatchSettings): PlayerSetup {
  return {
    name: id === 0 ? 'P1' : 'P2',
    characterId: CHARACTERS[id].id,
    deck: ALL_CARD_IDS.slice(0, settings.deckSize),
  }
}

function buildPlayer(id: PlayerId, setup: PlayerSetup): PlayerState {
  return {
    id,
    name: setup.name.trim() || (id === 0 ? 'P1' : 'P2'),
    characterId: setup.characterId,
    deck: [...setup.deck],
    remaining: [...setup.deck],
    momentum: 0,
    godAura: false,
    perfectStreak: 0,
    movesPlayed: 0,
  }
}

export function createMatch(
  settings: MatchSettings,
  setups: [PlayerSetup, PlayerSetup],
  seed: number = Date.now() >>> 0,
): MatchState {
  return {
    settings,
    phase: { kind: 'idle' },
    active: 0,
    players: [buildPlayer(0, setups[0]), buildPlayer(1, setups[1])],
    balance: 0,
    lastPlayed: null,
    turnIndex: 0,
    log: [],
    pendingEnd: null,
    seed,
    events: [],
  }
}

/** Waits for the phone to change hands. Nothing ticks until READY. */
function startHandoff(state: MatchState, player: PlayerId): MatchState {
  return {
    ...state,
    active: player,
    phase: { kind: 'handoff', player },
    events: [...state.events, { type: 'phase', phase: 'handoff', player }],
  }
}

function startChoosing(state: MatchState, now: number): MatchState {
  return {
    ...state,
    phase: { kind: 'choosing', startedAt: now, endsAt: now + state.settings.chooseMs },
    events: [...state.events, { type: 'phase', phase: 'choosing', player: state.active }],
  }
}

/** Match-ending conditions, checked once the turn has been scored. */
function endCondition(state: MatchState): MatchState['pendingEnd'] {
  if (Math.abs(state.balance) >= MOGGED_THRESHOLD) {
    return { winner: state.balance > 0 ? 0 : 1, reason: 'mogged' }
  }
  // Moves, not cards. Freezing on the clock costs the turn but takes nothing
  // out of the hand, so a player who froze simply finishes holding one.
  if (state.players.every((p) => p.movesPlayed >= state.settings.deckSize)) {
    const winner: PlayerId | null = state.balance === 0 ? null : state.balance > 0 ? 0 : 1
    return { winner, reason: 'moves' }
  }
  return null
}

/**
 * What the rival took on their last play, for the OUTAURA'D comparison. A play
 * they missed is worth nothing to beat: you can only out-aura a performance.
 *
 * Nobody can out-aura on their own opening move. Without that rule the player
 * who goes second gets one extra comparison over the match — worth four points
 * of win rate in a simulated mirror, handed out for the coin toss.
 */
function rivalLastAura(state: MatchState): number {
  if (state.players[state.active].movesPlayed === 0) return 0
  for (let i = state.log.length - 1; i >= 0; i--) {
    if (state.log[i].player !== state.active) return Math.max(0, state.log[i].aura)
  }
  return 0
}

function scoreCardPlay(
  state: MatchState,
  card: Card,
  judgement: Judgement,
  now: number,
): MatchState {
  const active = state.active
  const player = state.players[active]

  const play: Play = {
    card,
    judgement,
    freshness: freshnessOf(card, state.lastPlayed),
    godAura: player.godAura,
    streak: streakOf(player.perfectStreak, judgement),
    rivalLast: rivalLastAura(state),
  }

  const { lines, total: aura } = scorePlay(play)
  const momentum = applyMomentum(player.momentum, player.godAura, play)

  const result: TurnResult = {
    player: active,
    cardId: card.id,
    judgement,
    freshness: play.freshness,
    aura,
    lines,
    perfectStreak: play.streak,
    momentumBefore: player.momentum,
    momentumAfter: momentum.momentum,
    godAuraBefore: player.godAura,
    godAuraAfter: momentum.godAura,
  }

  const players = [...state.players] as MatchState['players']
  players[active] = {
    ...player,
    momentum: momentum.momentum,
    godAura: momentum.godAura,
    perfectStreak: play.streak,
    movesPlayed: player.movesPlayed + 1,
  }

  const events: GameEvent[] = [
    ...state.events,
    { type: 'phase', phase: 'resolve', player: active },
    { type: 'judgement', player: active, result },
  ]
  if (momentum.godAura !== player.godAura) {
    events.push({ type: 'godAura', player: active, on: momentum.godAura })
  }

  const next: MatchState = {
    ...state,
    players,
    balance: clamp(
      state.balance + (active === 0 ? aura : -aura),
      -MOGGED_THRESHOLD,
      MOGGED_THRESHOLD,
    ),
    lastPlayed: { cardId: card.id, kind: card.kind },
    log: [...state.log, result],
    phase: { kind: 'resolve', result, startedAt: now },
    events,
  }

  const pendingEnd = endCondition(next)
  if (pendingEnd?.reason === 'mogged' && pendingEnd.winner !== null) {
    next.events = [...next.events, { type: 'mogged', winner: pendingEnd.winner }]
  }
  return { ...next, pendingEnd }
}

/**
 * Ran out of time while choosing. The turn is spent and the momentum is gone,
 * and that is the whole of it.
 *
 * It used to burn a random card as well. Losing a move you never got to make
 * is already the punishment; having the game reach into your hand and throw
 * away something you chose, at random, on top of it, was arbitrary twice over.
 */
function loseComposure(state: MatchState, now: number): MatchState {
  const active = state.active
  const player = state.players[active]

  const result: TurnResult = {
    player: active,
    cardId: null,
    judgement: 'LOST_COMPOSURE',
    freshness: null,
    aura: 0,
    lines: [],
    perfectStreak: 0,
    momentumBefore: player.momentum,
    momentumAfter: 0,
    godAuraBefore: player.godAura,
    godAuraAfter: false,
  }

  const players = [...state.players] as MatchState['players']
  players[active] = {
    ...player,
    momentum: 0,
    godAura: false,
    perfectStreak: 0,
    movesPlayed: player.movesPlayed + 1,
  }

  const events: GameEvent[] = [
    ...state.events,
    { type: 'phase', phase: 'lostComposure', player: active },
    { type: 'judgement', player: active, result },
  ]
  if (player.godAura) events.push({ type: 'godAura', player: active, on: false })

  const next: MatchState = {
    ...state,
    players,
    log: [...state.log, result],
    phase: { kind: 'lostComposure', result, startedAt: now },
    events,
  }
  return { ...next, pendingEnd: endCondition(next) }
}

/**
 * Called when the next player says they have the phone. There is no separate
 * handoff screen between turns any more: the score sheet was the thing being
 * waited on, so it is the thing that waits.
 */
function advanceTurn(state: MatchState, now: number): MatchState {
  if (state.pendingEnd) {
    const { winner, reason } = state.pendingEnd
    return {
      ...state,
      phase: { kind: 'matchEnd', winner, reason },
      events: [...state.events, { type: 'matchEnd', winner, reason }],
    }
  }
  const handed: MatchState = {
    ...state,
    active: (1 - state.active) as PlayerId,
    turnIndex: state.turnIndex + 1,
  }
  return startChoosing(handed, now)
}

export function step(state: MatchState, action: Action): MatchState {
  // Events only describe the step that just ran. Copying only when there is
  // something to clear keeps the object identity stable across idle ticks, so
  // React subscribers do not re-render 60 times a second for nothing.
  const s: MatchState = state.events.length ? { ...state, events: [] } : state

  switch (action.type) {
    case 'START':
      return startHandoff(
        createMatch(action.settings, action.setups, action.seed ?? state.seed),
        0,
      )

    case 'READY':
      // The opening handoff starts the first turn; a score sheet ends one.
      if (s.phase.kind === 'handoff') return startChoosing(s, action.now)
      if (s.phase.kind === 'resolve' || s.phase.kind === 'lostComposure') {
        return advanceTurn(s, action.now)
      }
      return s

    case 'SELECT_CARD': {
      if (s.phase.kind !== 'choosing') return s
      const player = s.players[s.active]
      if (!player.remaining.includes(action.cardId)) return s

      // The card leaves the table the moment it is committed: no take-backs,
      // and the rival sees it go.
      const players = [...s.players] as MatchState['players']
      players[s.active] = {
        ...player,
        remaining: player.remaining.filter((id) => id !== action.cardId),
      }

      return {
        ...s,
        players,
        phase: { kind: 'performIntro', cardId: action.cardId, endsAt: action.now + INTRO_MS },
        events: [{ type: 'phase', phase: 'performIntro', player: s.active }],
      }
    }

    case 'QTE_RESULT': {
      if (s.phase.kind !== 'qte') return s
      return scoreCardPlay(s, getCard(s.phase.cardId), action.judgement, action.now)
    }

    case 'RESUME': {
      const { skippedMs, now } = action
      if (skippedMs <= 0) return s

      /**
       * Push the deadline back by the lost time, but never past a full fresh
       * phase: a stall that started before this phase began would otherwise
       * hand out more time than the phase is worth.
       */
      const pushed = (endsAt: number, total: number) => Math.min(endsAt + skippedMs, now + total)

      switch (s.phase.kind) {
        case 'choosing': {
          const total = s.settings.chooseMs
          const endsAt = pushed(s.phase.endsAt, total)
          return { ...s, phase: { ...s.phase, startedAt: endsAt - total, endsAt } }
        }
        case 'qte': {
          const total = qteWindow(s.phase.cardId)
          const endsAt = pushed(s.phase.endsAt, total)
          return { ...s, phase: { ...s.phase, startedAt: endsAt - total, endsAt } }
        }
        case 'performIntro':
          return { ...s, phase: { ...s.phase, endsAt: pushed(s.phase.endsAt, INTRO_MS) } }
        default:
          // Handoff and the score sheet have no deadline: they wait for a
          // human, not for the clock.
          return s
      }
    }

    case 'TICK': {
      const { now } = action
      switch (s.phase.kind) {
        case 'choosing':
          return now >= s.phase.endsAt ? loseComposure(s, now) : s

        case 'performIntro': {
          if (now < s.phase.endsAt) return s
          const card = getCard(s.phase.cardId)
          const roll = nextRandom(s.seed)
          return {
            ...s,
            seed: roll.seed,
            phase: {
              kind: 'qte',
              cardId: card.id,
              startedAt: now,
              endsAt: now + qteWindow(card.id),
              variation: roll.value,
            },
            events: [{ type: 'phase', phase: 'qte', player: s.active }],
          }
        }

        // Running out of QTE time without a result is a MISS.
        case 'qte':
          return now >= s.phase.endsAt ? scoreCardPlay(s, getCard(s.phase.cardId), 'MISS', now) : s

        default:
          return s
      }
    }

    default:
      return s
  }
}

// --- Selectors ---------------------------------------------------------------

export function activePlayer(state: MatchState): PlayerState {
  return state.players[state.active]
}

export function remainingCards(player: PlayerState): Card[] {
  return player.remaining.map(getCard)
}

/**
 * What the player about to move has to beat for OUTAURA'D, or null when the
 * rival has nothing on the table worth beating. Derived from the same rule the
 * scoring uses, so the promise on the picker cannot drift from the payout.
 */
export function outauraTarget(state: MatchState): { last: number; needed: number } | null {
  const last = rivalLastAura(state)
  if (last <= 0) return null
  return {
    last,
    needed: Math.ceil((last * OUTAURA_RATIO) / AURA_ROUNDING) * AURA_ROUNDING,
  }
}

/** Milliseconds left in the current timed phase, for countdown UI. */
export function timeLeft(state: MatchState, now: number): number {
  const phase = state.phase
  return 'endsAt' in phase ? Math.max(0, phase.endsAt - now) : 0
}
