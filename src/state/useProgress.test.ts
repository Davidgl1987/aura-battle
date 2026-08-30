import { beforeEach, describe, expect, it } from 'vitest'
import { SOLO_DECK_SIZE } from '../engine/balance'
import { LOCKED_CARD_IDS, STARTER_CARD_IDS, getCard } from '../engine/cards'
import { RIVALS } from '../engine/rivals'
import type { BattleStats } from '../engine/stats'
import {
  bankedFor,
  currentRival,
  deckIsLegal,
  defaultDeck,
  hasCard,
  isRivalBeaten,
  isRivalUnlocked,
  unlockedBy,
  useProgress,
} from './useProgress'

const BLANK: BattleStats = {
  winner: null,
  reason: 'moves',
  mogged: false,
  turns: 0,
  totalAura: [0, 0],
  perfectCount: [0, 0],
  goodCount: [0, 0],
  missCount: [0, 0],
  lostComposureCount: [0, 0],
  bestStreak: [0, 0],
  maxMomentum: [0, 0],
  outauraCount: [0, 0],
  hardLanded: [0, 0],
  godAuraReached: [false, false],
}

const stats = (patch: Partial<BattleStats>): BattleStats => ({ ...BLANK, ...patch })
/** A battle the player won and nothing else. */
const won = (patch: Partial<BattleStats> = {}) => stats({ winner: 0, ...patch })

const claim = (rivalId: string, s: BattleStats) => useProgress.getState().claim(rivalId, s, 0)
const state = () => useProgress.getState()

const [ROOKIE, KID, MEWER] = RIVALS

describe('what you start with', () => {
  beforeEach(() => useProgress.getState().resetProgress())

  it('opens with the nine easy cards and nothing else', () => {
    expect(state().unlockedCards).toEqual([...STARTER_CARD_IDS])
    expect(state().coins).toBe(0)
    expect(state().unlockedAccessories).toEqual([])
    for (const id of LOCKED_CARD_IDS) expect(hasCard(state(), id)).toBe(false)
  })

  it('builds an opening deck that spreads across the kinds', () => {
    const deck = defaultDeck()
    expect(deck).toHaveLength(SOLO_DECK_SIZE)
    expect(new Set(deck).size).toBe(SOLO_DECK_SIZE)
    // Freshness is measured on kind, so a deck of one kind would teach the
    // wrong lesson in the first battle anybody plays.
    expect(new Set(deck.map((id) => getCard(id).kind)).size).toBe(3)
    expect(deck.every((id) => STARTER_CARD_IDS.includes(id))).toBe(true)
  })

  it('starts with only the first rival open', () => {
    expect(isRivalUnlocked(state(), ROOKIE.id)).toBe(true)
    for (const rival of RIVALS.slice(1)) {
      expect(isRivalUnlocked(state(), rival.id), rival.name).toBe(false)
    }
    expect(currentRival(state())).toBe(ROOKIE.id)
  })
})

describe('claiming what a battle was worth', () => {
  beforeEach(() => useProgress.getState().resetProgress())

  it('pays nothing for a battle that met nothing', () => {
    const result = claim(ROOKIE.id, stats({ winner: 1 }))
    expect(result.rewards).toEqual([])
    expect(result.fresh).toEqual([false, false, false])
    expect(state().coins).toBe(0)
    expect(state().unlockedCards).toEqual([...STARTER_CARD_IDS])
  })

  it('hands over the card for the win and nothing it did not earn', () => {
    const result = claim(ROOKIE.id, won())
    expect(result.met).toEqual([true, false, false])
    expect(result.rewards).toEqual([{ kind: 'card', cardId: ROOKIE.signatureCardId }])
    expect(hasCard(state(), ROOKIE.signatureCardId)).toBe(true)
    expect(state().coins).toBe(0)
    expect(state().unlockedAccessories).toEqual([])
  })

  it('pays all three at once when all three land', () => {
    const result = claim(ROOKIE.id, won({ mogged: true, totalAura: [9999, 0] }))
    expect(result.fresh).toEqual([true, true, true])
    expect(result.rewards).toHaveLength(3)
    expect(hasCard(state(), ROOKIE.signatureCardId)).toBe(true)
    expect(state().coins).toBeGreaterThan(0)
    expect(state().unlockedAccessories).toContain('starter-cap')
  })

  /** The whole reason `claim` exists rather than three separate unlock calls. */
  it('pays each objective once and only once', () => {
    claim(ROOKIE.id, won({ totalAura: [9999, 0] }))
    const coinsAfterFirst = state().coins
    const cardsAfterFirst = state().unlockedCards.length

    const again = claim(ROOKIE.id, won({ totalAura: [9999, 0] }))
    expect(again.met).toEqual([true, true, false])
    expect(again.banked).toEqual([true, true, false])
    expect(again.fresh).toEqual([false, false, false])
    expect(again.rewards).toEqual([])
    expect(state().coins).toBe(coinsAfterFirst)
    expect(state().unlockedCards).toHaveLength(cardsAfterFirst)
  })

  it('keeps an objective banked even after a battle that missed it', () => {
    claim(ROOKIE.id, won())
    // Lost the rematch. The card is not taken back.
    const result = claim(ROOKIE.id, stats({ winner: 1 }))
    expect(result.met[0]).toBe(false)
    expect(result.banked[0]).toBe(true)
    expect(bankedFor(state(), ROOKIE.id)[0]).toBe(true)
    expect(hasCard(state(), ROOKIE.signatureCardId)).toBe(true)
  })

  it('lets a challenge be picked up on a battle that was lost', () => {
    // The three are independent: reaching god aura counts whether or not the
    // battle went your way, which is what makes a rematch worth playing.
    const showoff = RIVALS[3]
    const result = claim(showoff.id, stats({ winner: 1, godAuraReached: [true, false] }))
    expect(result.met).toEqual([false, false, true])
    expect(state().unlockedAccessories).toContain('drip-jacket')
    expect(isRivalBeaten(state(), showoff.id)).toBe(false)
  })

  it('scores the player it was asked about, not whoever won', () => {
    const asRival = useProgress.getState().claim(ROOKIE.id, stats({ winner: 1 }), 1)
    expect(asRival.met[0]).toBe(true)
  })
})

describe('climbing the ladder', () => {
  beforeEach(() => useProgress.getState().resetProgress())

  it('opens the next rival on the win alone', () => {
    claim(ROOKIE.id, won())
    expect(isRivalUnlocked(state(), KID.id)).toBe(true)
    // And no further: one win opens one door.
    expect(isRivalUnlocked(state(), MEWER.id)).toBe(false)
    expect(currentRival(state())).toBe(KID.id)
  })

  it('does not open anything for the optional two', () => {
    // Aura and the challenge are worth rewards, never progress.
    claim(ROOKIE.id, stats({ winner: 1, mogged: false, totalAura: [9999, 0] }))
    expect(state().coins).toBeGreaterThan(0)
    expect(isRivalUnlocked(state(), KID.id)).toBe(false)
  })

  it('walks the whole ladder one win at a time', () => {
    for (const rival of RIVALS) {
      expect(isRivalUnlocked(state(), rival.id), `${rival.name} is open`).toBe(true)
      claim(rival.id, won())
    }
    // Every locked card is now in hand, and nothing else appeared with them.
    for (const id of LOCKED_CARD_IDS) expect(hasCard(state(), id), id).toBe(true)
    expect(state().unlockedCards).toHaveLength(STARTER_CARD_IDS.length + LOCKED_CARD_IDS.length)
    expect(currentRival(state())).toBe(RIVALS[RIVALS.length - 1].id)
  })

  it('knows which rival is holding a card you do not have', () => {
    for (const rival of RIVALS) expect(unlockedBy(rival.signatureCardId)).toBe(rival.id)
    expect(unlockedBy('mewing')).toBeNull()
  })
})

describe('the deck you take in', () => {
  beforeEach(() => useProgress.getState().resetProgress())

  it('refuses a deck of the wrong size', () => {
    const before = state().deck
    useProgress.getState().setDeck(STARTER_CARD_IDS.slice(0, 3))
    expect(state().deck).toEqual(before)
  })

  it('refuses a deck holding a card you have not won', () => {
    const before = state().deck
    useProgress.getState().setDeck([...STARTER_CARD_IDS.slice(0, 4), LOCKED_CARD_IDS[0]])
    expect(state().deck).toEqual(before)
  })

  it('refuses the same card twice', () => {
    const before = state().deck
    const doubled = [STARTER_CARD_IDS[0], ...STARTER_CARD_IDS.slice(0, 4)]
    expect(deckIsLegal(state(), doubled)).toBe(false)
    useProgress.getState().setDeck(doubled)
    expect(state().deck).toEqual(before)
  })

  it('takes a legal one, including a card just won', () => {
    claim(ROOKIE.id, won())
    const withPrize = [ROOKIE.signatureCardId, ...STARTER_CARD_IDS.slice(0, SOLO_DECK_SIZE - 1)]
    useProgress.getState().setDeck(withPrize)
    expect(state().deck).toEqual(withPrize)
  })
})

describe('the wardrobe', () => {
  beforeEach(() => useProgress.getState().resetProgress())

  it('will not equip something you do not own', () => {
    useProgress.getState().equip('head', 'starter-cap')
    expect(state().equippedAccessories.head).toBeUndefined()
  })

  it('equips what you won, and takes it off again', () => {
    claim(ROOKIE.id, won({ mogged: true }))
    useProgress.getState().equip('head', 'starter-cap')
    expect(state().equippedAccessories.head).toBe('starter-cap')

    useProgress.getState().equip('head', null)
    expect(state().equippedAccessories.head).toBeUndefined()
  })
})

describe('what survives closing the tab', () => {
  beforeEach(() => useProgress.getState().resetProgress())

  it('writes the whole of it out and reads the whole of it back', async () => {
    claim(ROOKIE.id, won({ mogged: true, totalAura: [9999, 0] }))
    useProgress.getState().equip('head', 'starter-cap')
    useProgress.getState().setSettings({ music: false, vibration: false })
    const saved = { ...state() }

    // Same trip a reload takes: serialise, wipe, hydrate.
    await useProgress.persist.rehydrate()

    expect(state().coins).toBe(saved.coins)
    expect(state().unlockedCards).toEqual(saved.unlockedCards)
    expect(state().unlockedAccessories).toEqual(saved.unlockedAccessories)
    expect(state().equippedAccessories).toEqual(saved.equippedAccessories)
    expect(state().objectives).toEqual(saved.objectives)
    expect(state().settings).toEqual(saved.settings)
    expect(state().deck).toEqual(saved.deck)
    // And the ladder still reads the same way on the other side.
    expect(isRivalUnlocked(state(), KID.id)).toBe(true)
  })

  it('drops a saved deck that no longer makes sense', () => {
    // A card can leave the pool between builds. Loading a deck that points at
    // one throws on the first render of the collection rather than at load.
    const merged = useProgress.persist.getOptions().merge!(
      { deck: ['ghost-card', 'mewing'], unlockedCards: ['mewing', 'ghost-card'], coins: 40 },
      useProgress.getState(),
    ) as ReturnType<typeof state>

    expect(merged.deck).toEqual(defaultDeck())
    expect(merged.unlockedCards).not.toContain('ghost-card')
    expect(merged.coins).toBe(40)
  })

  it('gives back the starters to a save that predates them', () => {
    const merged = useProgress.persist.getOptions().merge!(
      { unlockedCards: ['griddy-drop'] },
      useProgress.getState(),
    ) as ReturnType<typeof state>

    for (const id of STARTER_CARD_IDS) expect(merged.unlockedCards).toContain(id)
    expect(merged.unlockedCards).toContain('griddy-drop')
  })

  it('fills in a setting that did not exist when the save was written', () => {
    const merged = useProgress.persist.getOptions().merge!(
      { settings: { music: false } },
      useProgress.getState(),
    ) as ReturnType<typeof state>

    expect(merged.settings.music).toBe(false)
    expect(merged.settings.sfx).toBe(true)
    expect(merged.settings.language).toBe('en')
  })
})
