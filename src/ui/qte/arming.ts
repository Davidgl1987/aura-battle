import { useEffect, useState } from 'react'
import { QTE_ARM_MS } from '../../engine/balance'

/**
 * Every QTE holds still until the player's first touch. The card is already
 * committed by then, so reaching for the glass is not part of the challenge
 * and must not eat the window.
 *
 * The only reason a QTE ever starts by itself is to keep the battle moving:
 * without that, refusing to touch would be a way to dodge a MISS forever.
 */
export function armTime(startedAt: number, armedAt: number | null, now: number): number | null {
  if (armedAt !== null) return armedAt
  return now - startedAt >= QTE_ARM_MS ? startedAt + QTE_ARM_MS : null
}

export interface Arming {
  /** The moment the QTE went live, or null while it still waits. */
  readonly armedAt: number | null
  /** Call from the first pointer input. Later calls are ignored. */
  arm(at: number): void
  /** Call once per frame; arms on its own once the wait runs out. */
  resolve(now: number): number | null
  /** A pause shifted the phase clock, so carry the arm time along with it. */
  rebase(startedAt: number): void
  /**
   * Milliseconds until it starts by itself, or 0 once it is live. Nobody who
   * is playing ever sees this reach zero, but a player who has not realised
   * the QTE is waiting for them has to be told that it will not wait forever.
   */
  countdown(now: number): number
}

export function createArming(startedAt: number): Arming {
  let armedAt: number | null = null
  let origin = startedAt

  return {
    get armedAt() {
      return armedAt
    },
    arm(at) {
      if (armedAt === null) armedAt = at
    },
    resolve(now) {
      armedAt = armTime(origin, armedAt, now)
      return armedAt
    },
    rebase(next) {
      if (armedAt !== null) armedAt += next - origin
      origin = next
    },
    countdown(now) {
      return armedAt !== null ? 0 : Math.max(0, QTE_ARM_MS - (now - origin))
    },
  }
}

/** Stable across renders, so widget rAF loops can hold on to it. */
export function useArming(startedAt: number): Arming {
  const [arming] = useState(() => createArming(startedAt))

  useEffect(() => {
    arming.rebase(startedAt)
  }, [arming, startedAt])

  return arming
}
