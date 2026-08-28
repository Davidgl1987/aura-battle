import {
  CHOOSE_SECONDS_MAX,
  CHOOSE_SECONDS_MIN,
  DECK_SIZE_MAX,
  DECK_SIZE_MIN,
} from '../../engine/balance'
import { RIVALS, getRival } from '../../engine/rivals'
import { useGame } from '../../state/store'
import { Stepper } from '../Stepper'

interface Props {
  /** How many rivals are already down, for the solo card's progress. */
  beaten: number
  nextRivalId: string
  onClose: () => void
}

/**
 * A sheet rather than a screen. Choosing who you are playing is one decision
 * and it should cost one tap, not a page you have to come back out of.
 *
 * The local game's own settings live on its card, because that is the only
 * place they mean anything: solo runs one fixed format so its objectives are
 * comparable from the first rival to the last.
 */
export function ModeSheet({ beaten, nextRivalId, onClose }: Props) {
  const go = useGame((s) => s.go)
  const beginSetup = useGame((s) => s.beginSetup)
  const settings = useGame((s) => s.settings)
  const setSettings = useGame((s) => s.setSettings)

  const next = getRival(nextRivalId)
  const done = beaten === RIVALS.length

  return (
    <div className="sheet" role="dialog" aria-label="Choose a mode">
      <button className="sheet__scrim" aria-label="Close" onPointerDown={onClose} />

      <div className="sheet__body">
        <div className="sheet__grab" />

        <button className="mode mode--solo" onPointerDown={() => go('rivals')}>
          <span className="mode__head">
            <span className="mode__name">SOLO</span>
            <span className="mode__count">
              {beaten}/{RIVALS.length}
            </span>
          </span>
          <span className="mode__note">
            {done ? 'Every rival beaten. Go back for the objectives you left.' : `Next up · ${next.name}`}
          </span>
          <span className="mode__progress" aria-hidden>
            {RIVALS.map((rival, i) => (
              <span key={rival.id} className="mode__pip" data-done={i < beaten} />
            ))}
          </span>
        </button>

        <div className="mode mode--local">
          <button className="mode__hit" onPointerDown={beginSetup}>
            <span className="mode__head">
              <span className="mode__name">1 VS 1</span>
            </span>
            <span className="mode__note">Two players, one phone</span>
          </button>

          <div className="settings settings--inline">
            <Stepper
              label="CARDS PER DECK"
              value={settings.deckSize}
              min={DECK_SIZE_MIN}
              max={DECK_SIZE_MAX}
              onChange={(deckSize) => setSettings({ deckSize })}
            />
            <Stepper
              label="TIME TO CHOOSE"
              value={Math.round(settings.chooseMs / 1000)}
              min={CHOOSE_SECONDS_MIN}
              max={CHOOSE_SECONDS_MAX}
              suffix="s"
              onChange={(seconds) => setSettings({ chooseMs: seconds * 1000 })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
