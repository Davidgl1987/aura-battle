import { useGame } from '../../state/store'
import { SettingsList } from './SettingsList'

/** Four rows. Anything that is not one of these belongs on another screen. */
export function SettingsScreen() {
  const go = useGame((s) => s.go)

  return (
    <div className="screen screen--settings">
      <header className="sub__top">
        <button className="back" onPointerDown={() => go('home')}>
          ‹ HOME
        </button>
        <h2 className="sub__title">SETTINGS</h2>
      </header>

      <SettingsList />
    </div>
  )
}
