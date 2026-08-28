import type { CSSProperties } from 'react'
import { getCard } from '../engine/cards'
import { useI18n } from '../i18n'
import { getCharacter } from '../engine/characters'
import type { MatchState } from '../engine/types'

/**
 * The cards already spent, oldest first: tinted with whoever spent them, and
 * outlined with the kind they were, because the kind is what freshness is
 * measured against.
 *
 * The rival's remaining hand used to sit here. Open information sounded fair
 * until you follow it through: whoever moves second gets to answer a hand they
 * can see, and picks their FRESH counter with no reading involved. What has
 * already come out is a different thing — it is the shared record of the
 * battle, and both players watched it happen.
 */
export function PlayedStrip({ match }: { match: MatchState }) {
  const { t } = useI18n()
  if (match.log.length === 0) return null

  return (
    <div className="strip">
      <span className="strip__label">{t('match.played')}</span>
      <div className="strip__cards">
        {match.log.map((turn, i) => {
          const who = getCharacter(match.players[turn.player].characterId).color
          const style = { '--who': who } as CSSProperties

          // A frozen turn produced no move, but it happened and it cost them
          // one, so it belongs in the record as the gap that it was.
          if (!turn.cardId) {
            return (
              <span key={i} className="chip chip--played" data-frozen="true" style={style}>
                😬
              </span>
            )
          }

          const card = getCard(turn.cardId)
          return (
            <span key={i} className="chip chip--played" data-kind={card.kind} style={style}>
              {card.emoji}
            </span>
          )
        })}
      </div>
    </div>
  )
}
