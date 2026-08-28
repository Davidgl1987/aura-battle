import { create } from 'zustand'
import { DEFAULT_SETTINGS, SOLO_SETTINGS } from '../engine/balance'
import { CHARACTERS } from '../engine/characters'
import { createMatch, defaultSetup, step } from '../engine/match'
import { battleStats } from '../engine/stats'
import { getRival, type Rival } from '../engine/rivals'
import { useProgress, type ClaimResult } from './useProgress'
import type {
  Action,
  GameEvent,
  MatchSettings,
  MatchState,
  PlayerId,
  PlayerSetup,
} from '../engine/types'

/**
 * Single clock for the whole game. The reducer, the QTE widgets, the
 * countdowns, the fighters and the particles all read this one function.
 *
 * It is `performance.now()` minus however long the game has spent paused, so
 * pausing is a property of the clock rather than something every animation has
 * to be taught about separately. Freeze this and everything downstream stops
 * on its own.
 */
let pausedAt: number | null = null
let lost = 0

export const now = (): number => (pausedAt ?? performance.now()) - lost

/**
 * A pointer event's `timeStamp` on the same clock. Events are stamped against
 * `performance.now()`, which knows nothing about pauses; judgements are taken
 * from those stamps, so they have to be brought over.
 */
export const stamp = (raw: number): number => raw - lost

function holdClock(paused: boolean): void {
  if (paused) {
    pausedAt ??= performance.now()
    return
  }
  if (pausedAt === null) return
  lost += performance.now() - pausedAt
  pausedAt = null
}

/**
 * Home is the hub. Solo goes home → rivals → battle; local keeps the flow it
 * always had, home → P1 sets up → the phone changes hands → P2 sets up →
 * battle. In-match handoffs are a phase of the reducer, not a screen.
 */
export type Screen = 'home' | 'rivals' | 'collection' | 'setup' | 'setupHandoff' | 'match'

/** Who is on the other side of the phone. */
export type Mode = 'local' | 'solo'

/**
 * The body the player takes into a solo battle. No rival uses this build, so
 * you are never standing opposite yourself in a different colour.
 */
export const PLAYER_CHARACTER = 'blocky'

const blankSetups = (settings: MatchSettings): [PlayerSetup, PlayerSetup] => [
  defaultSetup(0, settings),
  defaultSetup(1, settings),
]

interface GameStore {
  screen: Screen
  mode: Mode
  /** The rival being fought, when `mode` is 'solo'. */
  opponentId: string | null
  settings: MatchSettings
  /** Filled in one player at a time during setup. */
  setups: [PlayerSetup | null, PlayerSetup | null]
  setupIndex: PlayerId
  match: MatchState
  /**
   * What the finished solo battle paid out. Banked by `dispatch` the moment
   * the match ends rather than by the results screen, so it happens exactly
   * once whatever React does with the component that shows it.
   */
  claimed: ClaimResult | null
  /** Events produced by the last step, drained by the VFX/audio layer. */
  bus: GameEvent[]
  /** Nothing timed advances while this is on. See `useGameClock`. */
  paused: boolean

  setSettings: (patch: Partial<MatchSettings>) => void
  setPaused: (value: boolean) => void
  go: (screen: Screen) => void
  /**
   * One way into a battle, whoever is answering the other side of it. `seed`
   * is for tests and the dev console: a match replays exactly from it, and
   * that promise is worth nothing if there is no way to pin one.
   */
  startBattle: (
    opts: ({ mode: 'solo'; opponentId: string } | { mode: 'local' }) & { seed?: number },
  ) => void
  beginSetup: () => void
  submitSetup: (setup: PlayerSetup) => void
  confirmSetupHandoff: () => void
  dispatch: (action: Action) => void
  rematch: () => void
  toTitle: () => void
}

function startMatch(
  state: GameStore,
  setups: [PlayerSetup, PlayerSetup],
  settings: MatchSettings = state.settings,
  seed: number = (Math.random() * 0xffffffff) >>> 0,
): Partial<GameStore> {
  const match = step(state.match, {
    type: 'START',
    now: now(),
    seed,
    settings,
    setups,
  })
  // Deliberately not written back into the store: `settings` there is the
  // local game's configuration, which the players set themselves. Solo runs
  // its own format, and a solo battle must not quietly leave the deck builder
  // asking for five cards next time two people play.
  //
  // START emits too — the opening handoff among others. Skipping the bus here
  // dropped the first sound of every match on the floor.
  return { screen: 'match', setups, match, claimed: null, bus: match.events }
}

/**
 * The rival's side of the table, built from their configuration. Nothing here
 * is a different kind of player: it is the same `PlayerSetup` the deck builder
 * produces, with `controller` set and a look attached.
 */
function rivalSetup(rival: Rival): PlayerSetup {
  return {
    name: rival.name,
    characterId: rival.characterId,
    deck: [...rival.deck],
    controller: 'cpu',
    look: rival.look,
  }
}

export const useGame = create<GameStore>((set, get) => ({
  screen: 'home',
  mode: 'local',
  opponentId: null,
  settings: DEFAULT_SETTINGS,
  setups: [null, null],
  setupIndex: 0,
  match: createMatch(DEFAULT_SETTINGS, blankSetups(DEFAULT_SETTINGS)),
  claimed: null,
  bus: [],
  paused: false,

  setPaused: (value) => {
    holdClock(value)
    set({ paused: value })
  },

  setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

  go: (screen) => set({ screen }),

  startBattle: (opts) => {
    holdClock(false)
    if (opts.mode === 'local') {
      const { setups } = get()
      if (!setups[0] || !setups[1]) return
      set({
        ...startMatch(get(), setups as [PlayerSetup, PlayerSetup], get().settings, opts.seed),
        mode: 'local',
        opponentId: null,
        paused: false,
      })
      return
    }

    const rival = getRival(opts.opponentId)
    // The player brings what they have saved; the rival brings what they are.
    // Both go through the same reducer, in the one format solo runs.
    const player: PlayerSetup = {
      name: 'YOU',
      characterId: PLAYER_CHARACTER,
      deck: [...useProgress.getState().deck],
    }
    const setups: [PlayerSetup, PlayerSetup] = [player, rivalSetup(rival)]
    set({
      ...startMatch(get(), setups, SOLO_SETTINGS, opts.seed),
      mode: 'solo',
      opponentId: rival.id,
      paused: false,
    })
  },

  // Deck size can change on the home screen, so any half-built deck is stale.
  beginSetup: () =>
    set({ screen: 'setup', mode: 'local', opponentId: null, setupIndex: 0, setups: [null, null] }),

  submitSetup: (setup) => {
    const { setupIndex, setups } = get()
    const next: [PlayerSetup | null, PlayerSetup | null] = [...setups]
    next[setupIndex] = setup

    if (setupIndex === 0) {
      set({ setups: next, setupIndex: 1, screen: 'setupHandoff' })
      return
    }
    set(startMatch(get(), next as [PlayerSetup, PlayerSetup]))
  },

  confirmSetupHandoff: () => set({ screen: 'setup' }),

  dispatch: (action) => {
    const before = get().match
    const next = step(before, action)
    if (next === before) return
    set(next.events.length ? { match: next, bus: next.events } : { match: next })

    // The battle just ended. Banking here rather than in the results screen
    // keeps it to one call: a screen that claims on mount claims twice under
    // StrictMode, and the second one reports nothing new.
    const { mode, opponentId, claimed } = get()
    if (
      mode === 'solo' &&
      opponentId &&
      !claimed &&
      next.phase.kind === 'matchEnd' &&
      before.phase.kind !== 'matchEnd'
    ) {
      set({ claimed: useProgress.getState().claim(opponentId, battleStats(next), 0) })
    }
  },

  rematch: () => {
    const { mode, opponentId, setups } = get()
    if (mode === 'solo' && opponentId) {
      get().startBattle({ mode: 'solo', opponentId })
      return
    }
    if (!setups[0] || !setups[1]) return
    holdClock(false)
    set({ ...startMatch(get(), setups as [PlayerSetup, PlayerSetup]), paused: false })
  },

  toTitle: () => {
    holdClock(false)
    set({
      screen: 'home',
      mode: 'local',
      opponentId: null,
      setups: [null, null],
      setupIndex: 0,
      claimed: null,
      paused: false,
    })
  },
}))

/** The character the other player already claimed, if any. */
export function takenCharacterId(
  setups: GameStore['setups'],
  index: PlayerId,
): string | undefined {
  return setups[index === 0 ? 1 : 0]?.characterId
}

export const FIRST_CHARACTER = CHARACTERS[0].id

// --- Handy selectors ---------------------------------------------------------
export const usePhase = () => useGame((s) => s.match.phase)
export const useActive = () => useGame((s) => s.match.active)
export const useBalance = () => useGame((s) => s.match.balance)
export const useLastPlayed = () => useGame((s) => s.match.lastPlayed)

// Dev handle: drive the match from the console (`__game.getState().dispatch(...)`)
// to reproduce a phase without playing up to it. Guarded so the store can be
// imported outside a browser — the tests run in plain node.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __game: typeof useGame }).__game = useGame
}
