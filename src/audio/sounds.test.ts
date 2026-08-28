import { describe, expect, it } from 'vitest'
import type { GameEvent, TurnResult } from '../engine/types'
import { SOUNDS, type SoundName, soundFor, soundLength } from './sounds'

const result = (judgement: TurnResult['judgement']): GameEvent => ({
  type: 'judgement',
  player: 0,
  result: {
    player: 0,
    cardId: 'mewing',
    judgement,
    freshness: 'FRESH',
    aura: 1100,
    lines: [
      { key: 'base', label: judgement, value: 800 },
      { key: 'fresh', label: 'FRESH MOVE', value: 300 },
    ],
    perfectStreak: judgement === 'PERFECT' ? 1 : 0,
    momentumBefore: 0,
    momentumAfter: 25,
    godAuraBefore: false,
    godAuraAfter: false,
  },
})

const names = Object.keys(SOUNDS) as SoundName[]

describe('the sound bank', () => {
  it('is audible: every sound makes some noise for some time', () => {
    for (const name of names) {
      const sound = SOUNDS[name]
      expect(sound.tones.length + (sound.noise?.length ?? 0), name).toBeGreaterThan(0)
      expect(soundLength(sound), name).toBeGreaterThan(0)
    }
  })

  it('keeps every voice in range and at a sane level', () => {
    for (const name of names) {
      for (const t of SOUNDS[name].tones) {
        expect(t.freq, name).toBeGreaterThan(20)
        expect(t.freq, name).toBeLessThan(20000)
        if (t.slideTo !== undefined) expect(t.slideTo, name).toBeGreaterThan(20)
        // Well under 1 each: a dozen of these can overlap without clipping.
        expect(t.gain, name).toBeGreaterThan(0)
        expect(t.gain, name).toBeLessThanOrEqual(0.45)
      }
    }
  })

  it('never lets one sound run past the beat it belongs to', () => {
    for (const name of names) {
      expect(soundLength(SOUNDS[name]), name).toBeLessThanOrEqual(1100)
    }
  })

  it('keeps the taps short enough to mash', () => {
    // A mash card wants 22 taps in two seconds: ~90ms apart.
    expect(soundLength(SOUNDS.tap)).toBeLessThan(90)
    expect(soundLength(SOUNDS.tick)).toBeLessThan(90)
  })
})

describe('what the match sounds like', () => {
  it('has a distinct sound for each judgement', () => {
    const heard = (['PERFECT', 'GOOD', 'MISS', 'LOST_COMPOSURE'] as const).map((j) =>
      soundFor(result(j)),
    )
    expect(heard).toEqual(['perfect', 'good', 'miss', 'fumble'])
    expect(new Set(heard).size).toBe(4)
  })

  it('announces god aura arriving and leaving differently', () => {
    expect(soundFor({ type: 'godAura', player: 0, on: true })).toBe('godAura')
    expect(soundFor({ type: 'godAura', player: 0, on: false })).toBe('godAuraLost')
  })

  it('marks the phone changing hands and nothing else about phases', () => {
    expect(soundFor({ type: 'phase', phase: 'handoff', player: 1 })).toBe('handoff')
    expect(soundFor({ type: 'phase', phase: 'qte', player: 1 })).toBeNull()
    expect(soundFor({ type: 'phase', phase: 'choosing', player: 0 })).toBeNull()
  })

  it('only names sounds that exist', () => {
    const events: GameEvent[] = [
      result('PERFECT'),
      { type: 'godAura', player: 1, on: true },
      { type: 'mogged', winner: 0 },
      { type: 'phase', phase: 'handoff', player: 0 },
      { type: 'matchEnd', winner: null, reason: 'moves' },
    ]
    for (const event of events) {
      const name = soundFor(event)
      if (name) expect(SOUNDS[name]).toBeDefined()
    }
  })
})
