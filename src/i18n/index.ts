import { useCallback, useEffect } from 'react'
import { useProgress } from '../state/useProgress'
import en from './en.json'
import es from './es.json'

/**
 * Every string the game says, in one file per language.
 *
 * English is the source: `TextKey` is derived from it, and the dictionary map
 * below is typed against it, so a Spanish file missing a key stops the build
 * rather than showing a raw key to somebody mid-battle.
 *
 * What does *not* live here: card names, rival names and character names. They
 * are the game's own nouns — GRIDDY DROP is GRIDDY DROP in either language,
 * the way a move in a fighting game is.
 */
export type Lang = 'en' | 'es'
export type TextKey = keyof typeof en

const DICTIONARIES: Record<Lang, Record<TextKey, string>> = { en, es }

export const LANGUAGES: readonly { id: Lang; label: string }[] = [
  { id: 'en', label: 'ENGLISH' },
  { id: 'es', label: 'ESPAÑOL' },
]

/** Numbers are grouped the way the reader expects: 8,000 or 8.000. */
const LOCALES: Record<Lang, string> = { en: 'en-US', es: 'es-ES' }

export type Vars = Record<string, string | number>

/**
 * Substitutes `{name}` placeholders. A key ending `.one` is used instead when
 * `n` is exactly 1, which is the whole of the plural handling this game needs:
 * "1 card left" rather than "1 cards left".
 */
export function translate(lang: Lang, key: TextKey, vars?: Vars): string {
  const dict = DICTIONARIES[lang]
  const singular = `${key}.one` as TextKey
  const use = vars?.n === 1 && singular in dict ? singular : key

  // Falling back to English rather than to the key: a gap in a translation
  // should read as untranslated, not as broken.
  const raw = dict[use] ?? en[use] ?? en[key] ?? key
  if (!vars) return raw
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  )
}

export type T = (key: TextKey, vars?: Vars) => string

export interface I18n {
  t: T
  /** A number in the reader's own grouping. */
  n: (value: number) => string
  lang: Lang
}

export function useI18n(): I18n {
  const lang = useProgress((s) => s.settings.language)

  // The document says which language it is in, so a screen reader picks the
  // right voice and the browser offers the right translation. It is stamped
  // `en` in the HTML and the setting can change under it at any time.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback<T>((key, vars) => translate(lang, key, vars), [lang])
  const n = useCallback((value: number) => value.toLocaleString(LOCALES[lang]), [lang])

  return { t, n, lang }
}
