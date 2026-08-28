import { create } from 'zustand'
import { DEFAULT_SETTINGS } from '../engine/balance'
import { CHARACTERS } from '../engine/characters'
import { createMatch, defaultSetup, step } from '../engine/match'
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
 * Title → P1 sets up → the phone changes hands → P2 sets up → battle.
 * In-match handoffs are a phase of the reducer, not a screen.
 */
export type Screen = 'title' | 'setup' | 'setupHandoff' | 'match'

const blankSetups = (settings: MatchSettings): [PlayerSetup, PlayerSetup] => [
  defaultSetup(0, settings),
  defaultSetup(1, settings),
]

interface GameStore {
  screen: Screen
  settings: MatchSettings
  /** Filled in one player at a time during setup. */
  setups: [PlayerSetup | null, PlayerSetup | null]
  setupIndex: PlayerId
  match: MatchState
  /** Events produced by the last step, drained by the VFX/audio layer. */
  bus: GameEvent[]
  muted: boolean
  /** Nothing timed advances while this is on. See `useGameClock`. */
  paused: boolean

  setSettings: (patch: Partial<MatchSettings>) => void
  toggleMuted: () => void
  setPaused: (value: boolean) => void
  beginSetup: () => void
  submitSetup: (setup: PlayerSetup) => void
  confirmSetupHandoff: () => void
  dispatch: (action: Action) => void
  rematch: () => void
  toTitle: () => void
}

function startMatch(state: GameStore, setups: [PlayerSetup, PlayerSetup]): Partial<GameStore> {
  const match = step(state.match, {
    type: 'START',
    now: now(),
    seed: (Math.random() * 0xffffffff) >>> 0,
    settings: state.settings,
    setups,
  })
  // START emits too — the opening handoff among others. Skipping the bus here
  // dropped the first sound of every match on the floor.
  return { screen: 'match', setups, match, bus: match.events }
}

export const useGame = create<GameStore>((set, get) => ({
  screen: 'title',
  settings: DEFAULT_SETTINGS,
  setups: [null, null],
  setupIndex: 0,
  match: createMatch(DEFAULT_SETTINGS, blankSetups(DEFAULT_SETTINGS)),
  bus: [],
  muted: false,
  paused: false,

  toggleMuted: () => set({ muted: !get().muted }),

  setPaused: (value) => {
    holdClock(value)
    set({ paused: value })
  },

  setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

  // Deck size can change on the title screen, so any half-built deck is stale.
  beginSetup: () => set({ screen: 'setup', setupIndex: 0, setups: [null, null] }),

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
    const next = step(get().match, action)
    if (next === get().match) return
    set(next.events.length ? { match: next, bus: next.events } : { match: next })
  },

  rematch: () => {
    const { setups } = get()
    if (!setups[0] || !setups[1]) return
    holdClock(false)
    set({ ...startMatch(get(), setups as [PlayerSetup, PlayerSetup]), paused: false })
  },

  toTitle: () => {
    holdClock(false)
    set({ screen: 'title', setups: [null, null], setupIndex: 0, paused: false })
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
