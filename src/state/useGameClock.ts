import { useEffect } from 'react'
import { now, useGame } from './store'

/**
 * A gap this long is not a slow frame: the tab was hidden, the browser paused
 * rAF, or the phone locked. Anything shorter is normal jitter.
 */
const STALL_MS = 250

/**
 * Drives the reducer's timed phases. The reducer returns the same state object
 * when a tick changes nothing, so idle frames cost no React renders.
 */
export function useGameClock(): void {
  const dispatch = useGame((s) => s.dispatch)

  useEffect(() => {
    let raf = 0
    let last = now()

    const loop = () => {
      const t = now()

      // No special case for pause: `now()` stops advancing while the game is
      // held, so the gap is zero, the tick changes nothing and every deadline
      // stays exactly where it was.
      const gap = t - last
      last = t
      // Give back the time the game was not running, or the player comes back
      // to a countdown that already expired without them.
      if (gap > STALL_MS) dispatch({ type: 'RESUME', skippedMs: gap, now: t })
      dispatch({ type: 'TICK', now: t })
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [dispatch])
}
