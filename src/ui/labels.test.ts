import { describe, expect, it } from 'vitest'
import { ACCESSORIES } from '../engine/accessories'
import { CARDS } from '../engine/cards'
import type { ObjectiveCheck } from '../engine/objectives'
import type { Reward } from '../engine/rewards'
import { RIVALS } from '../engine/rivals'
import type { AuraLine, AuraLineKey, Difficulty, Freshness, QteKind } from '../engine/types'
import { LANGUAGES, translate, type I18n, type Lang } from '../i18n'
import { billLabel, freshLabel, kindLabel, objectiveText, rewardText, tierLabel } from './labels'

/** The same object the hook hands components, without needing React. */
const i18nFor = (lang: Lang): I18n => ({
  lang,
  t: (key, vars) => translate(lang, key, vars),
  n: (value) => value.toLocaleString(lang === 'es' ? 'es-ES' : 'en-US'),
})

const LANGS = LANGUAGES.map((l) => i18nFor(l.id))

/** Every case in each union, so adding one without words is a failing test. */
const EVERY_OBJECTIVE: ObjectiveCheck[] = [
  { kind: 'win' },
  { kind: 'aura', amount: 4000 },
  { kind: 'mogged' },
  { kind: 'outaura', count: 1 },
  { kind: 'outaura', count: 2 },
  { kind: 'streak', length: 3 },
  { kind: 'perfects', count: 3 },
  { kind: 'godAura' },
  { kind: 'noMiss' },
  { kind: 'hardLanded', count: 3 },
  { kind: 'momentum', atLeast: 80 },
]

const EVERY_REWARD: Reward[] = [
  { kind: 'card', cardId: CARDS[0].id },
  { kind: 'coins', amount: 500 },
  { kind: 'accessory', accessoryId: ACCESSORIES[0].id },
]

const EVERY_LINE: AuraLine[] = (
  ['miss', 'base', 'fresh', 'hard', 'streak', 'outaurad', 'god'] as AuraLineKey[]
).map((key) => ({
  key,
  label: key === 'streak' ? 'PERFECT STREAK ×3' : key === 'base' ? 'PERFECT' : key.toUpperCase(),
  value: 100,
}))

/** Nothing the interface says may come out empty, or as a raw key. */
function assertSpoken(text: string, what: string) {
  expect(text.trim(), what).not.toBe('')
  expect(text, what).not.toMatch(/\{\w+\}/)
  expect(text, what).not.toMatch(/^[a-z]+\.[a-z]/i)
}

describe('putting the game into words', () => {
  it('has something to say for every objective, in every language', () => {
    for (const i18n of LANGS) {
      for (const check of EVERY_OBJECTIVE) {
        assertSpoken(objectiveText(check, i18n), `${i18n.lang}: ${check.kind}`)
      }
    }
  })

  it('tells one outaura apart from several', () => {
    const one = objectiveText({ kind: 'outaura', count: 1 }, LANGS[0])
    const two = objectiveText({ kind: 'outaura', count: 2 }, LANGS[0])
    expect(one).not.toBe(two)
    expect(two).toContain('2')
  })

  it('has something to say for every reward', () => {
    for (const i18n of LANGS) {
      for (const reward of EVERY_REWARD) {
        assertSpoken(rewardText(reward, i18n), `${i18n.lang}: ${reward.kind}`)
      }
    }
  })

  it('has something to say for every line of the bill', () => {
    for (const i18n of LANGS) {
      for (const line of EVERY_LINE) {
        assertSpoken(billLabel(line, i18n), `${i18n.lang}: ${line.key}`)
      }
    }
  })

  it('keeps the streak count when it translates the streak', () => {
    for (const i18n of LANGS) {
      const line = EVERY_LINE.find((l) => l.key === 'streak')!
      expect(billLabel(line, i18n), i18n.lang).toContain('3')
    }
  })

  it('tells a PERFECT apart from a GOOD on the top line', () => {
    for (const i18n of LANGS) {
      const perfect = billLabel({ key: 'base', label: 'PERFECT', value: 1 }, i18n)
      const good = billLabel({ key: 'base', label: 'GOOD', value: 1 }, i18n)
      expect(perfect, i18n.lang).not.toBe(good)
    }
  })

  it('names every kind, tier and freshness', () => {
    for (const i18n of LANGS) {
      for (const kind of ['timing', 'speed', 'control'] as QteKind[]) {
        assertSpoken(kindLabel(kind, i18n), `${i18n.lang}: ${kind}`)
      }
      for (const tier of [1, 2, 3] as Difficulty[]) {
        assertSpoken(tierLabel(tier, i18n), `${i18n.lang}: tier ${tier}`)
      }
      for (const fresh of ['FRESH', 'NEUTRAL', 'STALE'] as Freshness[]) {
        assertSpoken(freshLabel(fresh, i18n), `${i18n.lang}: ${fresh}`)
      }
    }
  })

  /**
   * The rivals' own objectives are the ones a player actually reads, so they
   * get checked as configured rather than only as a union of shapes.
   */
  it('reads every rival\'s three, in every language', () => {
    for (const i18n of LANGS) {
      for (const rival of RIVALS) {
        for (const objective of rival.objectives) {
          assertSpoken(objectiveText(objective.check, i18n), `${i18n.lang}: ${rival.name}`)
          assertSpoken(rewardText(objective.reward, i18n), `${i18n.lang}: ${rival.name}`)
        }
      }
    }
  })

  it('says the same thing differently in the two languages', () => {
    // A dictionary that had quietly fallen back to English everywhere would
    // otherwise pass every test above.
    const [en, es] = LANGS
    const differing = EVERY_OBJECTIVE.filter(
      (check) => objectiveText(check, en) !== objectiveText(check, es),
    )
    expect(differing.length).toBeGreaterThan(EVERY_OBJECTIVE.length / 2)
  })
})
