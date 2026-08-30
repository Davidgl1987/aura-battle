import { beforeEach, describe, expect, it } from 'vitest'
import { CARDS } from '../engine/cards'
import { now, useGame } from './store'
import { useProgress } from './useProgress'

/**
 * The first time a minigame comes up the battle stops and explains it. Two
 * things have to hold for that to be safe: the game clock really stops, so a
 * QTE deadline is not running behind the explanation, and the tutorial's hold
 * on the clock is its own rather than a use of the pause menu's.
 */
describe('holding the clock for a tutorial', () => {
  beforeEach(() => {
    useGame.getState().dismissTutorial()
    useGame.getState().setPaused(false)
  })

  it('stops the clock the tutorial is shown against', () => {
    useGame.getState().showTutorial('sweep')
    const frozen = now()
    // Real time passes; the game's own clock does not.
    const spin = performance.now() + 12
    while (performance.now() < spin) {
      /* burn a few real milliseconds */
    }
    expect(now()).toBe(frozen)

    useGame.getState().dismissTutorial()
    const spinAgain = performance.now() + 12
    while (performance.now() < spinAgain) {
      /* and now it moves again */
    }
    expect(now()).toBeGreaterThan(frozen)
  })

  it('does not put the pause menu on screen behind it', () => {
    useGame.getState().showTutorial('mash')
    expect(useGame.getState().tutorial).toBe('mash')
    expect(useGame.getState().paused).toBe(false)
  })

  /**
   * Two independent holds on one clock. Whichever is released first, the clock
   * stays stopped while the other still wants it stopped.
   */
  it('keeps the clock held while either of them wants it', () => {
    useGame.getState().setPaused(true)
    useGame.getState().showTutorial('zone')
    const frozen = now()

    useGame.getState().dismissTutorial()
    const spin = performance.now() + 12
    while (performance.now() < spin) {
      /* the pause menu is still up */
    }
    expect(now(), 'still paused').toBe(frozen)

    useGame.getState().setPaused(false)
    const spinAgain = performance.now() + 12
    while (performance.now() < spinAgain) {
      /* nothing is holding it now */
    }
    expect(now(), 'released').toBeGreaterThan(frozen)
  })
})

describe('what the phone remembers being taught', () => {
  beforeEach(() => useProgress.getState().resetProgress())

  it('starts knowing nothing', () => {
    expect(useProgress.getState().seenTutorials).toEqual([])
  })

  it('remembers a minigame once, however many times it is marked', () => {
    useProgress.getState().markTutorialSeen('sweep')
    useProgress.getState().markTutorialSeen('sweep')
    expect(useProgress.getState().seenTutorials).toEqual(['sweep'])
  })

  it('hands them all back for the next person to hold the phone', () => {
    for (const game of ['sweep', 'lanes', 'mash']) useProgress.getState().markTutorialSeen(game)
    expect(useProgress.getState().seenTutorials).toHaveLength(3)

    useProgress.getState().resetTutorials()
    expect(useProgress.getState().seenTutorials).toEqual([])
    // And nothing else was thrown away with them.
    expect(useProgress.getState().unlockedCards.length).toBeGreaterThan(0)
  })

  it('has one to show for every minigame in the pool', () => {
    // A card whose gesture had no tutorial would stop the battle on an empty
    // explanation, so the two lists have to stay in step.
    const games = new Set(CARDS.map((c) => c.qte.game))
    expect(games.size).toBe(6)
    for (const game of games) {
      useProgress.getState().markTutorialSeen(game)
    }
    expect(useProgress.getState().seenTutorials).toHaveLength(6)
  })
})
