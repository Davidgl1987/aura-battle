import { Suspense, lazy, useState } from 'react'
import { RIVALS } from '../../engine/rivals'
import { useI18n } from '../../i18n'
import { useGame } from '../../state/store'
import { currentRival, isRivalBeaten, useProgress } from '../../state/useProgress'
import { Glossary } from '../Glossary'
import { Sheet } from '../Sheet'
import { SettingsList } from '../settings/SettingsList'
import { ModeSheet } from './ModeSheet'

/** Same split as the battle: the hub paints instantly, three.js follows. */
const TitleShowcase = lazy(() =>
  import('../../scene/Showcase').then((m) => ({ default: m.TitleShowcase })),
)

/**
 * The hub. The cast owns the screen and everything else floats over it in two
 * bands — the name at the top, where you are going at the bottom.
 *
 * Nothing here ever changes size. Every panel is a sheet over the screen
 * rather than a section inside it, so the row of buttons stays exactly where a
 * thumb last saw it.
 */
type Panel = 'mode' | 'rules' | 'settings' | null

export function HomeScreen({ onTitleReady }: { onTitleReady: () => void }) {
  const { t, n } = useI18n()
  const go = useGame((s) => s.go)
  const coins = useProgress((s) => s.coins)
  const progress = useProgress()
  const [panel, setPanel] = useState<Panel>(null)

  const beaten = RIVALS.filter((r) => isRivalBeaten(progress, r.id)).length
  const close = () => setPanel(null)

  return (
    <div className="screen screen--home">
      {/* The splash over the top of all this is waiting on exactly one thing:
          the first frame the title can actually draw. */}
      <Suspense fallback={null}>
        <TitleShowcase report={onTitleReady} />
      </Suspense>

      <div className="home__top">
        {/* Above the name and off to one side: a currency you cannot spend yet
            should not be sharing a line with the name of the game, and at this
            size AURA reaches the edge anyway. */}
        <button className="coins" onPointerDown={() => go('collection')}>
          <span className="coins__icon">🪙</span>
          <span className="coins__value">{n(coins)}</span>
        </button>
        <h1 className="title">
          AURA<span>BATTLE</span>
        </h1>
      </div>

      <div className="home__foot">
        <button className="btn btn--big btn--play" onPointerDown={() => setPanel('mode')}>
          {t('home.play')}
        </button>

        <div className="hub">
          <button className="hub__item" onPointerDown={() => go('collection')}>
            <span className="hub__icon">🃏</span>
            <span className="hub__label">{t('home.collection')}</span>
          </button>
          {/* The wardrobe exists — rivals are wearing it — but there is nothing
              to change yet, and a button onto an empty screen is worse than a
              button that says so. */}
          <button className="hub__item" disabled data-locked="true">
            <span className="hub__icon">✨</span>
            <span className="hub__label">{t('home.customize')}</span>
            <span className="hub__soon">{t('home.soon')}</span>
          </button>
          <button className="hub__item" onPointerDown={() => setPanel('settings')}>
            <span className="hub__icon">⚙</span>
            <span className="hub__label">{t('home.settings')}</span>
          </button>
          <button className="hub__item" onPointerDown={() => setPanel('rules')}>
            <span className="hub__icon">❓</span>
            <span className="hub__label">{t('home.howToPlay')}</span>
          </button>
        </div>
      </div>

      {panel === 'mode' && (
        <ModeSheet beaten={beaten} nextRivalId={currentRival(progress)} onClose={close} />
      )}

      {panel === 'settings' && (
        <Sheet label={t('home.settings')} title={t('settings.title')} onClose={close}>
          <SettingsList />
        </Sheet>
      )}

      {panel === 'rules' && (
        <Sheet label={t('home.howToPlay')} title={t('home.howToPlay')} onClose={close}>
          {/* `.rules` is what sets the reading size and the left alignment;
              without it the glossary inherits the sheet's headline styling and
              comes out as centred 20px prose. */}
          <div className="rules rules--sheet">
            <ol className="rules__steps">
              <li>{t('rules.step1')}</li>
              <li>{t('rules.step2')}</li>
              <li>{t('rules.step3')}</li>
            </ol>
            <Glossary />
          </div>
        </Sheet>
      )}
    </div>
  )
}
