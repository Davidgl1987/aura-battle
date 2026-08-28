import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../engine/balance'
import { CARDS } from '../engine/cards'
import type { PlayerSetup } from '../engine/types'
import { useGame } from './store'

const deck = CARDS.slice(0, DEFAULT_SETTINGS.deckSize).map((c) => c.id)
const setups: [PlayerSetup, PlayerSetup] = [
  { name: 'P1', characterId: 'blocky', deck },
  { name: 'P2', characterId: 'noodle', deck },
]

function playThrough() {
  const { beginSetup, submitSetup } = useGame.getState()
  beginSetup()
  submitSetup(setups[0])
  useGame.getState().confirmSetupHandoff()
  useGame.getState().submitSetup(setups[1])
}

describe('the store', () => {
  beforeEach(() => useGame.getState().toTitle())

  it('walks the setup flow one player at a time', () => {
    const { beginSetup, submitSetup } = useGame.getState()
    beginSetup()
    expect(useGame.getState().screen).toBe('setup')
    expect(useGame.getState().setupIndex).toBe(0)

    submitSetup(setups[0])
    // The phone has to change hands before P2 sees anything.
    expect(useGame.getState().screen).toBe('setupHandoff')
    expect(useGame.getState().setupIndex).toBe(1)

    useGame.getState().confirmSetupHandoff()
    expect(useGame.getState().screen).toBe('setup')

    useGame.getState().submitSetup(setups[1])
    expect(useGame.getState().screen).toBe('match')
  })

  it('puts the opening events on the bus', () => {
    playThrough()
    const { bus, match } = useGame.getState()

    // Starting a match emits: without this the first handoff made no sound.
    expect(bus.length).toBeGreaterThan(0)
    expect(bus).toEqual(match.events)
    expect(bus.some((e) => e.type === 'phase' && e.phase === 'handoff')).toBe(true)
  })

  it('keeps the bus in step with the reducer as the match runs', () => {
    playThrough()
    const { dispatch } = useGame.getState()

    dispatch({ type: 'READY', now: performance.now() })
    expect(useGame.getState().bus.some((e) => e.type === 'phase' && e.phase === 'choosing')).toBe(
      true,
    )
  })

  it('leaves the bus alone when a step changes nothing', () => {
    playThrough()
    const { dispatch } = useGame.getState()
    dispatch({ type: 'READY', now: performance.now() })

    const settled = useGame.getState().bus
    dispatch({ type: 'TICK', now: performance.now() })
    dispatch({ type: 'READY', now: performance.now() }) // already choosing
    expect(useGame.getState().bus).toBe(settled)
  })

  it('starts a rematch from the same setups, with its own events', () => {
    playThrough()
    const before = useGame.getState().match

    useGame.getState().rematch()
    const after = useGame.getState()
    expect(after.screen).toBe('match')
    expect(after.match).not.toBe(before)
    expect(after.match.players.map((p) => p.characterId)).toEqual(['blocky', 'noodle'])
    expect(after.bus.length).toBeGreaterThan(0)
  })

  it('forgets half-built decks when it goes back to the title', () => {
    const { beginSetup, submitSetup } = useGame.getState()
    beginSetup()
    submitSetup(setups[0])
    useGame.getState().toTitle()

    expect(useGame.getState().setups).toEqual([null, null])
    expect(useGame.getState().setupIndex).toBe(0)
  })

  it('will not start a rematch it has no setups for', () => {
    const before = useGame.getState().match
    useGame.getState().rematch()
    expect(useGame.getState().match).toBe(before)
    expect(useGame.getState().screen).toBe('title')
  })
})
