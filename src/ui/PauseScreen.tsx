import { useState } from 'react'
import { useI18n } from '../i18n'
import { useGame } from '../state/store'
import { Glossary } from './Glossary'
import { SettingsList } from './settings/SettingsList'

/**
 * The battle held still. Everything downstream of the clock is frozen with it,
 * so this is also the only calm moment in a match — which makes it the right
 * place for the glossary and for the settings themselves, rather than for a
 * lone speaker button that could only turn everything off at once.
 */
type Panel = 'settings' | 'rules' | null

export function PauseScreen() {
  const { t } = useI18n()
  const setPaused = useGame((s) => s.setPaused)
  const toTitle = useGame((s) => s.toTitle)
  const [panel, setPanel] = useState<Panel>(null)
  const toggle = (which: Panel) => setPanel((open) => (open === which ? null : which))

  return (
    <div className="paused">
      <span className="paused__title">{t('pause.title')}</span>
      <span className="paused__note">{t('pause.note')}</span>

      {/* One at a time: between them they cover the whole screen, and the
          battle underneath is what the player is coming back to. */}
      {panel === 'settings' && <SettingsList compact />}
      {panel === 'rules' && (
        <div className="rules">
          <Glossary />
        </div>
      )}

      <button className="btn btn--big" onPointerDown={() => setPaused(false)}>
        {t('pause.resume')}
      </button>

      <div className="tabs">
        <button
          className="tab"
          data-open={panel === 'settings'}
          onPointerDown={() => toggle('settings')}
        >
          ⚙ {t('home.settings')}
        </button>
        <button className="tab" data-open={panel === 'rules'} onPointerDown={() => toggle('rules')}>
          ? {t('home.howToPlay')}
        </button>
        <button className="tab" onPointerDown={toTitle}>
          {t('pause.quit')}
        </button>
      </div>
    </div>
  )
}
