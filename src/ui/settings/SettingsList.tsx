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
  const settings = useProgress((s) => s.settings)
  const setSettings = useProgress((s) => s.setSettings)

  return (
    <div className="settings__list" data-compact={compact}>
      <Toggle
        label="MUSIC"
        note="Backing track during a battle"
        value={settings.music}
        onChange={(music) => setSettings({ music })}
      />
      <Toggle
        label="SFX"
        note="Hits, judgements and the crowd"
        value={settings.sfx}
        onChange={(sfx) => setSettings({ sfx })}
      />
      <Toggle
        label="VIBRATION"
        note="A buzz on every judgement"
        value={settings.vibration}
        onChange={(vibration) => setSettings({ vibration })}
      />

      <div className="setting setting--static">
        <span className="setting__text">
          <span className="setting__label">LANGUAGE</span>
          <span className="setting__note">More on the way</span>
        </span>
        <span className="setting__value">ENGLISH</span>
      </div>
    </div>
  )
}
