import { useEffect, useState } from 'react'

/**
 * How many fingers are on the glass, tracked from app start rather than from
 * when a component happens to mount. A widget that appears the instant a QTE
 * ends has missed every `pointerdown` that got it there, so it cannot work
 * this out for itself.
 */
const down = new Set<number>()
const watchers = new Set<() => void>()

function notify(): void {
  for (const watcher of watchers) watcher()
}

function press(event: PointerEvent): void {
  down.add(event.pointerId)
  notify()
}

function release(event: PointerEvent): void {
  down.delete(event.pointerId)
  notify()
}

// Capture phase: a handler further down that stops propagation must not be
// able to hide a finger from the count.
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', press, { capture: true })
  window.addEventListener('pointerup', release, { capture: true })
  window.addEventListener('pointercancel', release, { capture: true })
}

export function pointersDown(): number {
  return down.size
}

/**
 * Whether that exact pointer is still on the glass. A widget that remembers an
 * id has only remembered it: a `pointerup` that never arrived, or a capture the
 * browser dropped, leaves a grip that looks held and is not.
 */
export function isDown(id: number): boolean {
  return down.has(id)
}

/**
 * False until the glass has been clear for `quietMs`, then true for good.
 *
 * A latch, deliberately, and not a live reading of whether anything is being
 * touched. What it guards against is the tail of a 29-tap Sturdy carrying into
 * whatever replaces the QTE on screen — a hazard that exists for a moment and
 * then is over. Left as a live condition it also fired on the deliberate touch
 * that came next, which switched the control off under the hand using it.
 */
export function useSettled(quietMs: number, maxWaitMs = 2500): boolean {
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (settled) return

    let quiet = 0
    const open = () => setSettled(true)

    const check = () => {
      window.clearTimeout(quiet)
      if (pointersDown() > 0) return
      quiet = window.setTimeout(open, quietMs)
    }

    // A pointerup that never arrives — a dropped capture, a browser quirk —
    // would otherwise leave the control dead for good.
    const failsafe = window.setTimeout(open, maxWaitMs)

    check()
    watchers.add(check)

    return () => {
      window.clearTimeout(quiet)
      window.clearTimeout(failsafe)
      watchers.delete(check)
    }
  }, [settled, quietMs, maxWaitMs])

  return settled
}
