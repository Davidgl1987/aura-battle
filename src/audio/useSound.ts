import { useCallback, useEffect } from 'react'
import { useGame } from '../state/store'
import { useGameEvents } from '../state/useGameEvents'
import { crowd, play, setMuted, unlock } from './engine'
import { setMusicHeat } from './music'
import { crowdFor, soundFor } from './sounds'

/** Wires the match's events to the synthesiser. Mount once, near the root. */
export function useSound(): void {
  const muted = useGame((s) => s.muted)
  // Anyone's fire lifts the loop, not just the player whose turn it is.
  const lit = useGame((s) => s.match.players.some((p) => p.godAura))

  useEffect(() => setMuted(muted), [muted])
  useEffect(() => setMusicHeat(lit), [lit])

  // Audio cannot start before the player touches the screen, so the first
  // gesture anywhere opens the context. Several event types, because browsers
  // disagree about which one counts as the gesture — `unlock` is idempotent.
  //
  // These stay attached rather than firing once: coming back from another app
  // can leave the context suspended, and the next tap is the natural moment to
  // pick it back up.
  useEffect(() => {
    const open = () => unlock()
    const gestures = ['pointerdown', 'touchend', 'click', 'keydown'] as const
    for (const type of gestures) window.addEventListener(type, open)
    return () => {
      for (const type of gestures) window.removeEventListener(type, open)
    }
  }, [])

  useGameEvents(
    useCallback((event) => {
      const name = soundFor(event)
      if (name) play(name)
      const reaction = crowdFor(event)
      if (reaction) crowd(reaction)
    }, []),
  )
}
