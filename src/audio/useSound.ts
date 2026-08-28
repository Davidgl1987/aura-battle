import { useCallback, useEffect, useRef } from 'react'
import { useGame } from '../state/store'
import { useGameEvents } from '../state/useGameEvents'
import { useProgress } from '../state/useProgress'
import { crowd, play, setMusicMuted, setSfxMuted, unlock } from './engine'
import { setMusicHeat } from './music'
import { crowdFor, soundFor } from './sounds'

/** How long the phone buzzes for each result. A MISS gets the blunt one. */
const BUZZ_MS: Record<string, number> = {
  PERFECT: 18,
  GOOD: 10,
  MISS: 45,
  LOST_COMPOSURE: 45,
}

/** Wires the match's events to the synthesiser. Mount once, near the root. */
export function useSound(): void {
  const settings = useProgress((s) => s.settings)
  // Anyone's fire lifts the loop, not just the player whose turn it is.
  const lit = useGame((s) => s.match.players.some((p) => p.godAura))

  // Settings are the only switches there are; there is no separate mute.
  useEffect(() => setSfxMuted(!settings.sfx), [settings.sfx])
  useEffect(() => setMusicMuted(!settings.music), [settings.music])
  useEffect(() => setMusicHeat(lit), [lit])

  // Read through a ref so the event handler below stays stable: rebuilding it
  // on every settings change would re-run the drain and double-fire a batch.
  // Written in an effect rather than during render, the way `useGameEvents`
  // keeps its own handler current.
  const buzz = useRef(false)
  useEffect(() => {
    buzz.current = settings.vibration
  })

  /**
   * Try immediately, then on every gesture. Not every browser makes a page
   * wait for a tap — a desktop the player has used before will open the
   * context straight away — and gating the whole soundtrack on a gesture that
   * was never required meant the music sat silent until something was clicked.
   *
   * Where a gesture *is* required the early attempt leaves a suspended
   * context, and the listeners below resume it on the first touch. `unlock` is
   * idempotent, so nothing is lost either way.
   *
   * The listeners stay attached rather than firing once: coming back from
   * another app can leave the context suspended again, and the next tap is the
   * natural moment to pick it back up.
   */
  useEffect(() => {
    const open = () => unlock()
    open()
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

      // A judgement is the one moment worth feeling. Not every browser has
      // `vibrate`, and iOS Safari never has.
      if (event.type === 'judgement' && buzz.current && typeof navigator.vibrate === 'function') {
        navigator.vibrate(BUZZ_MS[event.result.judgement] ?? 12)
      }
    }, []),
  )
}
