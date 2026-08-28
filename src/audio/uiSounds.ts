import type { SoundName } from './sounds'

/**
 * What a tap on each part of the interface sounds like.
 *
 * One table and one delegated listener rather than a `play()` call wired into
 * every handler: the interface is dozens of buttons and the rule is the same
 * for all of them, so threading it through each component would be the same
 * decision written out dozens of times and forgotten once.
 *
 * Order matters — the first rule whose selector the tap lands inside wins, so
 * the specific ones come before `button`.
 */
type Rule = [selector: string, sound: (el: HTMLElement) => SoundName | null]

/**
 * The battle voices itself. A card leaving your hand plays `select`, a QTE pad
 * plays `tap` or `dead`, and a judgement is the loudest thing in the game — a
 * UI click layered on top of any of those is just a second noise.
 */
const VOICED_ELSEWHERE = '.hand, .qte, .slide, .cpu'

export const UI_SOUNDS: Rule[] = [
  // A switch says which way it went. `aria-checked` is read before React has
  // flipped it, so the sound is the state being left, inverted.
  ['[role="switch"]', (el) => (el.getAttribute('aria-checked') === 'true' ? 'uiOff' : 'uiOn')],

  // Anything you cannot have yet gets the same refusal, wherever it is.
  ['[data-locked="true"], :disabled', () => 'uiLocked'],

  // A move going into the deck, or coming back out of it.
  ['.pick', (el) => (el.dataset.picked === 'true' ? 'uiDrop' : 'uiPick')],

  ['.back, .setup__back, .sheet__scrim', () => 'uiBack'],
  ['.tab, .hub__item', () => 'uiOpen'],
  ['.btn--big, .btn--confirm, .mode__hit, .mode--solo', () => 'uiConfirm'],
  ['button', () => 'uiTap'],
]

/**
 * The sound a tap on `target` should make, or null for one the game already
 * has something to say about.
 */
export function uiSoundFor(target: EventTarget | null): SoundName | null {
  if (!(target instanceof Element)) return null
  if (target.closest(VOICED_ELSEWHERE)) return null

  for (const [selector, sound] of UI_SOUNDS) {
    const hit = target.closest<HTMLElement>(selector)
    if (hit) return sound(hit)
  }
  return null
}
