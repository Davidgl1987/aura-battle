import { chancesIn } from './qte'
import type { Card, Judgement } from './types'

/**
 * A rival never touches the glass, so a solo battle used to hand the player a
 * grade with nothing behind it: the fighter danced, a number appeared. This is
 * the middle of that — the shape of the attempt, beat by beat, so a MISS is
 * something you watch fall apart rather than something you are told about.
 *
 * It is a reading of the grade, not a second opinion on it: the beats always
 * add up to the judgement `judgeQte` already decided. Nothing here scores
 * anything.
 */
export type Beat = 'hit' | 'soft' | 'slip'

/**
 * How many discrete moments a card's gesture reads as. Taken from the QTE the
 * player would have been given, so watching a rival play Beat Drop shows seven
 * notes going by and watching them play Mewing shows two taps.
 */
export function beatsOf(card: Card): number {
  return Math.min(MAX_BEATS, Math.max(MIN_BEATS, declaredBeats(card)))
}

/** More than this on a phone-width strip and you can no longer count them. */
const MAX_BEATS = 8
/** And fewer than this is not a strip, it is a pair of dots. */
const MIN_BEATS = 3

function declaredBeats(card: Card): number {
  // What the card physically holds, not the bar it asks you to clear: watching
  // a rival play Beat Drop should show its six notes go by, not the three of
  // them that would have scored.
  return chancesIn(card)
}

/** The fractional part, which is all a roll is ever used for here. */
function frac(x: number): number {
  return x - Math.floor(x)
}

/**
 * A plausible run of beats that lands on `judgement`. Deterministic from
 * `roll`, so a battle replays with the same performance it had the first time.
 *
 * - PERFECT is clean all the way through.
 * - GOOD wobbles: a beat or two soft, nothing dropped.
 * - MISS drops at least one, and the rest is ragged around it.
 */
export function performance(card: Card, judgement: Judgement, roll: number): Beat[] {
  const total = beatsOf(card)
  const beats: Beat[] = Array.from({ length: total }, () => 'hit')
  if (judgement === 'PERFECT') return beats

  // Spread the damage around rather than always spoiling the same beat.
  const at = (n: number) => Math.min(total - 1, Math.floor(frac(roll * 97.13 * (n + 1)) * total))

  if (judgement === 'GOOD') {
    const soft = 1 + Math.floor(frac(roll * 13.7) * Math.max(1, Math.floor(total / 3)))
    for (let i = 0; i < soft; i++) beats[at(i)] = 'soft'
    return beats
  }

  const slips = 1 + Math.floor(frac(roll * 7.3) * Math.max(1, Math.floor(total / 2)))
  for (let i = 0; i < slips; i++) beats[at(i)] = 'slip'
  // Whatever survived the drop did not survive it cleanly.
  for (let i = 0; i < slips; i++) {
    const j = at(i + 11)
    if (beats[j] === 'hit') beats[j] = 'soft'
  }
  return beats
}
