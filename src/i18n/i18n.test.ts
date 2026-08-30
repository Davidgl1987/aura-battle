import { describe, expect, it } from 'vitest'
import { CARDS } from '../engine/cards'
import en from './en.json'
import es from './es.json'
import { LANGUAGES, translate, type Lang, type TextKey } from './index'

const DICTS: Record<Lang, Record<string, string>> = { en, es }
const KEYS = Object.keys(en) as TextKey[]

/** The `{name}` slots a string expects, as a set. */
const slots = (value: string) => new Set(value.match(/\{(\w+)\}/g) ?? [])

describe('the dictionaries', () => {
  it('offers every language it lists', () => {
    for (const { id, label } of LANGUAGES) {
      expect(DICTS[id], id).toBeDefined()
      expect(label.length).toBeGreaterThan(0)
    }
    expect(LANGUAGES.map((l) => l.id).sort()).toEqual(Object.keys(DICTS).sort())
  })

  it('answers every key in every language', () => {
    // The types already say so; this catches a JSON file edited by hand into
    // agreeing with the type by accident of key order.
    for (const [lang, dict] of Object.entries(DICTS)) {
      for (const key of KEYS) expect(dict[key], `${lang}: ${key}`).toBeTypeOf('string')
      expect(Object.keys(dict).sort(), `${lang} has no extra keys`).toEqual([...KEYS].sort())
    }
  })

  /**
   * A card whose gesture had no tutorial would stop the battle on an empty
   * explanation the first time it came up, and key parity between the two
   * languages cannot see that — the key would simply be missing from both.
   */
  it('has a tutorial for every minigame in the pool', () => {
    const games = [...new Set(CARDS.map((c) => c.qte.game))]
    expect(games).toHaveLength(6)
    for (const [lang, dict] of Object.entries(DICTS)) {
      for (const game of games) {
        expect(dict[`tutorial.${game}` as (typeof KEYS)[number]], `${lang}: ${game}`).toBeTypeOf(
          'string',
        )
      }
    }
  })

  it('says something in every one of them', () => {
    for (const [lang, dict] of Object.entries(DICTS)) {
      for (const key of KEYS) expect(dict[key].trim(), `${lang}: ${key}`).not.toBe('')
    }
  })

  /**
   * The most likely translation bug: a slot renamed on the way across, so the
   * Spanish string prints `{nombre}` at somebody instead of a rival's name.
   */
  it('keeps the same slots in every language', () => {
    for (const [lang, dict] of Object.entries(DICTS)) {
      for (const key of KEYS) {
        expect(slots(dict[key]), `${lang}: ${key}`).toEqual(slots(en[key]))
      }
    }
  })

  it('gives a singular wherever it counts things one at a time', () => {
    for (const key of KEYS) {
      if (!key.endsWith('.one')) continue
      const base = key.slice(0, -'.one'.length)
      expect(KEYS, `${key} has a plural to fall back to`).toContain(base)
    }
  })
})

describe('reading a string back', () => {
  it('fills the slots it was given', () => {
    expect(translate('en', 'rivals.goTo', { name: 'THE ROOKIE' })).toBe('GO TO THE ROOKIE')
    expect(translate('es', 'rivals.goTo', { name: 'THE ROOKIE' })).toBe('IR A THE ROOKIE')
  })

  it('leaves a slot it has no value for alone', () => {
    // Better a visible `{name}` than the word "undefined" in the middle of a
    // sentence: one reads as a bug, the other reads as the game being broken.
    expect(translate('en', 'rivals.goTo')).toContain('{name}')
    expect(translate('en', 'rivals.goTo', {})).toContain('{name}')
  })

  it('counts one thing as one thing', () => {
    expect(translate('en', 'common.cardsLeft', { n: 1 })).toBe('1 card left')
    expect(translate('en', 'common.cardsLeft', { n: 4 })).toBe('4 cards left')
    expect(translate('es', 'common.cardsLeft', { n: 1 })).toBe('queda 1 carta')
    expect(translate('es', 'common.cardsLeft', { n: 4 })).toBe('quedan 4 cartas')
  })

  it('is the same string every time', () => {
    for (const key of KEYS) {
      for (const { id } of LANGUAGES) {
        expect(translate(id, key)).toBe(translate(id, key))
      }
    }
  })
})
