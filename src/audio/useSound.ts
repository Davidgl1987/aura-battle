import { useCallback, useEffect, useRef } from 'react'
import { useGame } from '../state/store'
import { useGameEvents } from '../state/useGameEvents'
import { useProgress } from '../state/useProgress'
import { crowd, play, setMusicMuted, setSfxMuted, unlock } from './engine'
import { setMusicHeat } from './music'
import { crowdFor, soundFor } from './sounds'
import { uiSoundFor } from './uiSounds'

/**
 * What counts as pressing something, for the purpose of opening the audio.
 *
 * Deliberately not "whatever `uiSoundFor` answers to": that table decides what
 * a tap *sounds* like and it returns null for the controls the battle voices
 * itself — a card leaving your hand, a QTE pad. Those are all behind PLAY so
 * it would not matter today, but hanging the whole soundtrack on a lookup
 * table of sound effects is a coupling that would fail quietly.
 */
const CONTROL = 'button, [role="switch"]'

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
   * One listener for the whole interface: it opens the audio and it voices the
   * tap, in that order, because both are answers to the same question — did
   * the player just press something.
   *
   * `pointerdown` rather than `click`, because that is the event the buttons
   * themselves act on, so the sound and the thing it is announcing happen on
   * the same touch.
   *
   * What "press something" means is `CONTROL`, and the narrowness is the whole
   * point. This used to open the context on mount and again on every
   * `pointerdown`, `touchend`, `click` and `keydown` anywhere on the window.
   * On a desktop that meant the loop started over the loading splash, before
   * the title had drawn; on a phone it meant the music arrived on whatever the
   * player happened to brush first — the backdrop, the stage, a miss. Neither
   * reads as the game starting. Now the title screen's own biggest button is
   * the moment: press PLAY, the mode sheet opens and the loop comes in under
   * it, and a tap on the fighters behind it opens nothing.
   *
   * Attached for the whole session rather than firing once. Coming back from
   * another app can leave the context suspended, and the next press is the
   * natural place to pick it back up; `unlock` costs a state check once the
   * context is running.
   */
  useEffect(() => {
    const onTap = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest(CONTROL)) return
      unlock()
      const sound = uiSoundFor(target)
      if (sound) play(sound)
    }
    // The same press, on the way back up. An iPhone does not count a touch
    // going down as a gesture — it might be the start of a scroll — so the
    // `pointerdown` a finger produces cannot open the audio there, and never
    // could: `touchend` is what WebKit accepts, and it was in the list before
    // this was narrowed to controls. Narrowed the same way, so the moment is
    // unchanged — the loop comes in as the finger leaves PLAY rather than as
    // it lands — and `unlock` is a state check once the context is running.
    const onLift = (event: TouchEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest(CONTROL)) unlock()
    }
    window.addEventListener('pointerdown', onTap)
    window.addEventListener('touchend', onLift)
    return () => {
      window.removeEventListener('pointerdown', onTap)
      window.removeEventListener('touchend', onLift)
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
