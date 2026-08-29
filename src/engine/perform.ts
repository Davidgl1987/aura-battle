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
  return Math.min(MAX_BEATS, declaredBeats(card))
}

/** More than this on a phone-width strip and you can no longer count them. */
const MAX_BEATS = 8

function declaredBeats(card: Card): number {
  switch (card.qte.game) {
    case 'sweep':
      return card.qte.perfectAt
    case 'lanes':
      return card.qte.notes
    case 'order':
      return card.qte.perfectAt
    // A mash and a hold have no beats of their own, so they get a fixed strip
    // that reads as effort over time rather than as a count of anything.
    case 'mash':
      return 6
    case 'zone':
    case 'paths':
      return 5
  }
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
