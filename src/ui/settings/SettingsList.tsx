import { useEffect, useRef, useState } from 'react'
import { LANGUAGES, useI18n } from '../../i18n'
import { useProgress } from '../../state/useProgress'

interface ToggleProps {
  label: string
  note: string
  value: boolean
  onChange: (value: boolean) => void
}

function Toggle({ label, note, value, onChange }: ToggleProps) {
  return (
    <button
      className="setting"
      role="switch"
      aria-checked={value}
      onPointerDown={() => onChange(!value)}
    >
      <span className="setting__text">
        <span className="setting__label">{label}</span>
        <span className="setting__note">{note}</span>
      </span>
      <span className="setting__switch" data-on={value} aria-hidden>
        <span className="setting__knob" />
      </span>
    </button>
  )
}

/**
 * The four settings there are. Shared rather than copied, because the pause
 * menu is the one calm moment in a battle and it is exactly where somebody
 * reaches to turn the music down — and two lists that drift apart is how one
 * of them ends up missing a switch.
 *
 * `compact` drops the explanations: mid-battle nobody is reading them.
 */
export function SettingsList({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useI18n()
  const settings = useProgress((s) => s.settings)
  const setSettings = useProgress((s) => s.setSettings)

  const current = LANGUAGES.findIndex((l) => l.id === lang)
  const nextLang = LANGUAGES[(current + 1) % LANGUAGES.length]

  return (
    <div className="settings__list" data-compact={compact}>
      <Toggle
        label={t('settings.music')}
        note={t('settings.musicNote')}
        value={settings.music}
        onChange={(music) => setSettings({ music })}
      />
      <Toggle
        label={t('settings.sfx')}
        note={t('settings.sfxNote')}
        value={settings.sfx}
        onChange={(sfx) => setSettings({ sfx })}
      />
      <Toggle
        label={t('settings.vibration')}
        note={t('settings.vibrationNote')}
        value={settings.vibration}
        onChange={(vibration) => setSettings({ vibration })}
      />

      {/* Two languages cycle rather than opening a picker: a menu to choose
          between two things is one tap more than choosing between them. */}
      <button className="setting" onPointerDown={() => setSettings({ language: nextLang.id })}>
        <span className="setting__text">
          <span className="setting__label">{t('settings.language')}</span>
          <span className="setting__note">{t('settings.languageNote')}</span>
        </span>
        <span className="setting__value">{LANGUAGES[current]?.label}</span>
      </button>

      <WipeButton />
    </div>
  )
}

/**
 * Throwing the save away, behind one confirmation.
 *
 * The second tap is the dialog: a modal here would be a modal inside the pause
 * menu inside a battle, and the button already says what it is about to do.
 * The armed state times itself out so a stray tap cannot sit there waiting for
 * an accidental second one.
 */
function WipeButton() {
  const { t } = useI18n()
  const resetProgress = useProgress((s) => s.resetProgress)
  const [state, setState] = useState<'idle' | 'armed' | 'done'>('idle')
  const timer = useRef(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const again = (next: 'idle' | 'done', afterMs: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState(next), afterMs)
  }

  const press = () => {
    if (state === 'done') return
    if (state === 'idle') {
      setState('armed')
      again('idle', 4000)
      return
    }
    resetProgress()
    setState('done')
    again('idle', 2500)
  }

  const label = state === 'idle' ? 'wipe' : state === 'armed' ? 'wipeConfirm' : 'wipeDone'

  return (
    <button className="setting setting--danger" data-state={state} onPointerDown={press}>
      <span className="setting__text">
        <span className="setting__label">{t(`settings.${label}`)}</span>
        <span className="setting__note">{t(`settings.${label}Note`)}</span>
      </span>
    </button>
  )
}
