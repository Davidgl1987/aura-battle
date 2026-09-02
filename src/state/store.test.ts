import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SOLO_DECK_SIZE, SOLO_SETTINGS } from '../engine/balance'
import { CARDS, STARTER_CARD_IDS } from '../engine/cards'
import { getCharacter } from '../engine/characters'
import { playerColor } from '../engine/match'
import { RIVALS } from '../engine/rivals'
import type { PlayerSetup } from '../engine/types'
import {
  DEFAULT_PLAYER_CHARACTER,
  RIVAL_CHARACTER_PRESETS,
} from '../scene/firetoy/cast'
import { PLAYER_CHARACTER, useGame } from './store'
import { useProgress } from './useProgress'

const [ROOKIE] = RIVALS

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
    expect(useGame.getState().screen).toBe('home')
  })
})

describe('starting a solo battle', () => {
  beforeEach(() => {
    useGame.getState().toTitle()
    useProgress.getState().resetProgress()
  })

  it('sits the player opposite the rival, in the one solo format', () => {
    useGame.getState().startBattle({ mode: 'solo', opponentId: ROOKIE.id })
    const { screen, mode, opponentId, match, settings } = useGame.getState()

    expect(screen).toBe('match')
    expect(mode).toBe('solo')
    expect(opponentId).toBe(ROOKIE.id)
    // Solo runs one format whichever rival it is, so an aura objective means
    // the same thing all the way up the ladder — and it lives on the match,
    // not on the store, where it would overwrite the local game's own setup.
    expect(match.settings).toEqual(SOLO_SETTINGS)
    expect(settings).toEqual(DEFAULT_SETTINGS)
    expect(match.players[0].controller).toBe('human')
    expect(match.players[1].controller).toBe('cpu')
    expect(match.players[1].deck).toEqual(ROOKIE.deck)
    expect(match.players[0].deck).toEqual(useProgress.getState().deck)
  })

  it('dresses the rival in their own colour and drip', () => {
    useGame.getState().startBattle({ mode: 'solo', opponentId: ROOKIE.id })
    const rival = useGame.getState().match.players[1]

    expect(rival.look.color).toBe(ROOKIE.look.color)
    expect(rival.look.accessories).toEqual(ROOKIE.look.accessories)
    expect(playerColor(rival)).toBe(ROOKIE.look.color)
    // And the player keeps their own build's colour.
    expect(playerColor(useGame.getState().match.players[0])).toBe(
      getCharacter(PLAYER_CHARACTER).color,
    )
  })

  /**
   * Everyone on the stage is a Firetoy character, and no two of them may be
   * the same one. Two fighters sharing an outfit is not a cosmetic problem: in
   * a hot-seat battle it is the only thing telling you whose turn it is.
   */
  it('puts a Firetoy character on both sides of a solo battle', () => {
    useGame.getState().startBattle({ mode: 'solo', opponentId: ROOKIE.id })
    const [you, rival] = useGame.getState().match.players

    expect(you.look.character).toEqual(DEFAULT_PLAYER_CHARACTER)
    expect(rival.look.character).toEqual(RIVAL_CHARACTER_PRESETS[ROOKIE.id])
    expect(you.look.character).not.toEqual(rival.look.character)
  })

  it('gives every rival on the ladder their own body', () => {
    for (const r of RIVALS) {
      useGame.getState().startBattle({ mode: 'solo', opponentId: r.id })
      const [you, rival] = useGame.getState().match.players
      expect(rival.look.character, r.id).toEqual(RIVAL_CHARACTER_PRESETS[r.id])
      expect(rival.look.character?.outfit).not.toEqual(you.look.character?.outfit)
    }
  })

  it('dresses two people on one phone differently', () => {
    playThrough()
    const [p1, p2] = useGame.getState().match.players

    expect(p1.look.character).toBeDefined()
    expect(p2.look.character).toBeDefined()
    // Same file or not, they must not be wearing the same clothes.
    expect(p1.look.character).not.toEqual(p2.look.character)
  })

  it('takes the deck the player has actually saved', () => {
    const chosen = [...STARTER_CARD_IDS].reverse().slice(0, SOLO_DECK_SIZE)
    useProgress.getState().setDeck(chosen)
    useGame.getState().startBattle({ mode: 'solo', opponentId: ROOKIE.id })

    expect(useGame.getState().match.players[0].deck).toEqual(chosen)
  })

  it('rematches the same rival rather than the last local setups', () => {
    useGame.getState().startBattle({ mode: 'solo', opponentId: ROOKIE.id })
    const before = useGame.getState().match

    useGame.getState().rematch()
    const after = useGame.getState()
    expect(after.match).not.toBe(before)
    expect(after.mode).toBe('solo')
    expect(after.opponentId).toBe(ROOKIE.id)
    expect(after.match.players[1].name).toBe(ROOKIE.name)
  })

  it('forgets the rival on the way back to the hub', () => {
    useGame.getState().startBattle({ mode: 'solo', opponentId: ROOKIE.id })
    useGame.getState().toTitle()

    expect(useGame.getState().mode).toBe('local')
    expect(useGame.getState().opponentId).toBeNull()
  })

  it('puts a local battle back on the local settings afterwards', () => {
    // Solo swaps the settings for its own format; a local battle started after
    // one must not inherit them.
    useGame.getState().startBattle({ mode: 'solo', opponentId: ROOKIE.id })
    playThrough()

    expect(useGame.getState().mode).toBe('local')
    expect(useGame.getState().settings).toEqual(DEFAULT_SETTINGS)
    expect(useGame.getState().match.players.every((p) => p.controller === 'human')).toBe(true)
  })
})
