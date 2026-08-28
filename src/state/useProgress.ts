import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { SOLO_DECK_SIZE } from '../engine/balance'
import { CARDS, STARTER_CARD_IDS, getCard } from '../engine/cards'
import { met } from '../engine/objectives'
import type { Reward } from '../engine/rewards'
import { RIVALS, getRival, rivalIndex } from '../engine/rivals'
import type { BattleStats } from '../engine/stats'
import type { Lang } from '../i18n'
import type { AccessorySlot, PlayerId, QteKind } from '../engine/types'

/**
 * The only thing in the game that survives closing the tab. Everything else —
 * the match, the phase, whose turn it is — is temporary by design and lives in
 * `useGame`; this is the file that answers "what do I own".
 */

export interface SoloSettings {
  music: boolean
  sfx: boolean
  vibration: boolean
  language: Lang
}

export interface Progress {
  coins: number
  unlockedCards: string[]
  unlockedAccessories: string[]
  equippedAccessories: Partial<Record<AccessorySlot, string>>
  /** The deck taken into every solo battle. Exactly `SOLO_DECK_SIZE` cards. */
  deck: string[]
  /** By rival id, in that rival's own objective order. Absent means none done. */
  objectives: Record<string, boolean[]>
  settings: SoloSettings
}

/** What a finished battle was worth. Everything the results screen needs. */
export interface ClaimResult {
  rivalId: string
  /** Met in the battle just played. */
  met: boolean[]
  /** Already banked before this battle started. */
  banked: boolean[]
  /** Met for the first time — the only ones that paid out. */
  fresh: boolean[]
  /** What was actually handed over, in objective order. */
  rewards: Reward[]
}

/**
 * A spread rather than the first five in the file. Freshness is measured on
 * kind, so a starting deck of three Timing cards teaches the wrong lesson on
 * the first battle a player ever plays.
 */
export function defaultDeck(): string[] {
  const byKind = new Map<QteKind, string[]>()
  for (const id of STARTER_CARD_IDS) {
    const kind = getCard(id).kind
    byKind.set(kind, [...(byKind.get(kind) ?? []), id])
  }
  const out: string[] = []
  for (let round = 0; out.length < SOLO_DECK_SIZE; round++) {
    for (const ids of byKind.values()) {
      if (ids[round] && out.length < SOLO_DECK_SIZE) out.push(ids[round])
    }
  }
  return out
}

export const INITIAL_PROGRESS: Progress = {
  coins: 0,
  unlockedCards: [...STARTER_CARD_IDS],
  unlockedAccessories: [],
  equippedAccessories: {},
  deck: defaultDeck(),
  objectives: {},
  // The browser already knows which language the phone is in; asking again on
  // the first screen would be asking a question that has an answer.
  settings: {
    music: true,
    sfx: true,
    vibration: true,
    language: typeof navigator !== 'undefined' && navigator.language.startsWith('es') ? 'es' : 'en',
  },
}

// --- Derived, never stored ---------------------------------------------------

/** Which of a rival's three are already banked. */
export function bankedFor(progress: Progress, rivalId: string): boolean[] {
  const stored = progress.objectives[rivalId]
  const width = getRival(rivalId).objectives.length
  return Array.from({ length: width }, (_, i) => stored?.[i] ?? false)
}

/** Beating a rival is what opens the next one. The other two are optional. */
export function isRivalBeaten(progress: Progress, rivalId: string): boolean {
  return bankedFor(progress, rivalId)[0] === true
}

export function isRivalUnlocked(progress: Progress, rivalId: string): boolean {
  const index = rivalIndex(rivalId)
  if (index <= 0) return index === 0
  return isRivalBeaten(progress, RIVALS[index - 1].id)
}

/** The furthest rival open to the player, for "next up" on the home screen. */
export function currentRival(progress: Progress): string {
  const beatenAll = RIVALS.find((r) => !isRivalBeaten(progress, r.id))
  return beatenAll?.id ?? RIVALS[RIVALS.length - 1].id
}

export function hasCard(progress: Progress, cardId: string): boolean {
  return progress.unlockedCards.includes(cardId)
}

/** Which rival drops a card, for the label on a locked one in the collection. */
export function unlockedBy(cardId: string): string | null {
  return RIVALS.find((r) => r.signatureCardId === cardId)?.id ?? null
}

/** A deck is legal when it is the right size and every card is owned. */
export function deckIsLegal(progress: Progress, deck: string[]): boolean {
  return (
    deck.length === SOLO_DECK_SIZE &&
    new Set(deck).size === deck.length &&
    deck.every((id) => hasCard(progress, id))
  )
}

// --- Store -------------------------------------------------------------------

interface ProgressStore extends Progress {
  claim: (rivalId: string, stats: BattleStats, me: PlayerId) => ClaimResult
  setDeck: (deck: string[]) => void
  equip: (slot: AccessorySlot, accessoryId: string | null) => void
  setSettings: (patch: Partial<SoloSettings>) => void
  resetProgress: () => void
}

/**
 * Falls back to memory when there is no `localStorage` — the tests run in
 * plain node, and a store that throws on import is a store nothing can test.
 */
function storage() {
  if (typeof localStorage !== 'undefined') return localStorage
  const memory = new Map<string, string>()
  return {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  }
}

export const useProgress = create<ProgressStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_PROGRESS,

      /**
       * The one place a reward is ever handed out, and it only ever hands out
       * what has not been handed out before. Re-beating the Rookie is worth
       * the practice and nothing else.
       */
      claim: (rivalId, stats, me) => {
        const rival = getRival(rivalId)
        const banked = bankedFor(get(), rivalId)
        const hit = met(rival.objectives, stats, me)
        const fresh = hit.map((ok, i) => ok && !banked[i])

        const rewards: Reward[] = []
        let { coins, unlockedCards, unlockedAccessories } = get()

        for (let i = 0; i < rival.objectives.length; i++) {
          if (!fresh[i]) continue
          const reward = rival.objectives[i].reward
          rewards.push(reward)
          switch (reward.kind) {
            case 'coins':
              coins += reward.amount
              break
            case 'card':
              if (!unlockedCards.includes(reward.cardId)) {
                unlockedCards = [...unlockedCards, reward.cardId]
              }
              break
            case 'accessory':
              if (!unlockedAccessories.includes(reward.accessoryId)) {
                unlockedAccessories = [...unlockedAccessories, reward.accessoryId]
              }
              break
          }
        }

        set({
          coins,
          unlockedCards,
          unlockedAccessories,
          objectives: {
            ...get().objectives,
            [rivalId]: banked.map((was, i) => was || hit[i]),
          },
        })

        return { rivalId, met: hit, banked, fresh, rewards }
      },

      setDeck: (deck) => {
        // Silently ignoring an illegal deck would leave the picker showing one
        // thing and the battle using another.
        if (!deckIsLegal(get(), deck)) return
        set({ deck })
      },

      equip: (slot, accessoryId) => {
        if (accessoryId !== null && !get().unlockedAccessories.includes(accessoryId)) return
        const next = { ...get().equippedAccessories }
        if (accessoryId === null) delete next[slot]
        else next[slot] = accessoryId
        set({ equippedAccessories: next })
      },

      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

      resetProgress: () => set({ ...INITIAL_PROGRESS, deck: defaultDeck(), objectives: {} }),
    }),
    {
      name: 'aura-battle-progress',
      version: 1,
      storage: createJSONStorage(storage),
      /**
       * A saved deck can go stale — the card pool changes between builds, and
       * a deck holding a card that no longer exists throws on the first render
       * of the collection rather than at load.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Progress>
        const known = new Set(CARDS.map((c) => c.id))
        const unlockedCards = [
          ...new Set([...STARTER_CARD_IDS, ...(saved.unlockedCards ?? [])]),
        ].filter((id) => known.has(id))
        const deck = (saved.deck ?? []).filter((id) => unlockedCards.includes(id))

        return {
          ...current,
          ...saved,
          unlockedCards,
          deck: deck.length === SOLO_DECK_SIZE ? deck : defaultDeck(),
          settings: { ...INITIAL_PROGRESS.settings, ...saved.settings },
        }
      },
    },
  ),
)

/** The plain data, for the pure selectors above. */
export const progressOf = (s: ProgressStore): Progress => s
