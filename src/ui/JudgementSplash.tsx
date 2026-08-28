import type { CSSProperties } from 'react'
import { MOMENTUM_MAX } from '../engine/balance'
import { getCard } from '../engine/cards'
import { useI18n, type I18n } from '../i18n'
import { billLabel } from './labels'
import type { AuraLine, TurnResult } from '../engine/types'

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

/** Staggers each line in after the one above it, straight from CSS. */
const at = (index: number) => ({ '--i': index }) as CSSProperties

function BonusLine({ line, index, i18n }: { line: AuraLine; index: number; i18n: I18n }) {
  return (
    <li className="bill__line" data-line={line.key} style={at(index)}>
      <span className="bill__label">
        {billLabel(line, i18n)}
        {line.multiplier ? <em className="bill__mult">×{line.multiplier}</em> : null}
      </span>
      <span className="bill__value">{signed(line.value)}</span>
    </li>
  )
}

/**
 * The resolve screen adds up in front of the player. The headline judgement is
 * the first line of the bill rather than a caption above it, so the big number
 * always arrives with the reasons it got big — which is the only place FRESH,
 * HARD MOVE, streaks and OUTAURA'D are ever explained.
 *
 * Momentum gets its own row at the bottom. The meter up in the HUD moves on
 * every play, but a bar quietly sliding a few percent is not something anyone
 * notices mid-battle; the number has to be said out loud.
 */
export function JudgementSplash({ result }: { result: TurnResult }) {
  const card = result.cardId ? getCard(result.cardId) : null
  const i18n = useI18n()
  const { t } = i18n
  const composure = result.judgement === 'LOST_COMPOSURE'
  const momentum = result.momentumAfter - result.momentumBefore

  const [head, ...bonuses] = result.lines
  // The momentum row sits after every aura line, and the pass button after it.
  const momentumAt = result.lines.length + 1

  return (
    <div className="splash" data-judgement={result.judgement}>
      {card && (
        <div className="splash__card">
          {card.emoji} {card.name}
        </div>
      )}

      <div className="bill">
        {composure ? (
          <div className="bill__head" style={at(0)}>
            <span className="splash__judgement">{t('match.lostComposure')}</span>
          </div>
        ) : (
          <>
            <div className="bill__head" style={at(0)}>
              <span className="splash__judgement">{billLabel(head, i18n)}</span>
              <span className="bill__value">{signed(head.value)}</span>
            </div>

            {bonuses.length > 0 && (
              <ol className="bill__lines">
                {bonuses.map((line, i) => (
                  <BonusLine key={line.key} line={line} index={i + 1} i18n={i18n} />
                ))}
              </ol>
            )}

            {bonuses.length > 0 && (
              <div className="bill__total" style={at(result.lines.length)}>
                <span className="bill__total-value">{signed(result.aura)}</span>
                <span className="bill__total-unit">{t('common.aura')}</span>
              </div>
            )}
          </>
        )}

        <div className="bill__momentum" data-sign={momentum < 0 ? 'down' : 'up'} style={at(momentumAt)}>
          <span className="bill__label">
            {t(composure ? 'match.momentumWiped' : 'match.momentumPlain')}
          </span>
          <span className="bill__value">
            {momentum === 0 ? '—' : signed(momentum)}
            <em className="bill__of">
              {result.momentumAfter}/{MOMENTUM_MAX}
            </em>
          </span>
        </div>
      </div>

      {composure && <div className="splash__note">{t('match.composureNote')}</div>}
      {!result.godAuraBefore && result.godAuraAfter && <div className="splash__god">{t('match.godAura')}</div>}
      {result.godAuraBefore && !result.godAuraAfter && (
        <div className="splash__lost">{t('match.godAuraLost')}</div>
      )}
    </div>
  )
}
