import { getCard } from '../engine/cards'
import { getCharacter } from '../engine/characters'
import { recap, type PlayerRecap } from '../engine/recap'
import { useGame } from '../state/store'
import type { PlayerId } from '../engine/types'

interface Props {
  winner: PlayerId | null
  reason: 'mogged' | 'moves'
}

function Row({ row, won }: { row: PlayerRecap; won: boolean }) {
  const characterId = useGame((s) => s.match.players[row.player].characterId)
  const character = getCharacter(characterId)

  return (
    <div className="recap__row" data-won={won}>
      <div className="recap__who">
        <span style={{ color: character.color }}>
          {character.emoji} {row.name}
        </span>
        <span className="recap__aura">
          {row.totalAura > 0 ? `+${row.totalAura}` : row.totalAura}
          {row.reachedGodAura && ' 🔥'}
        </span>
      </div>

      <div className="recap__turns">
        {row.turns.map((turn, i) => (
          <span key={i} className="recap__turn" data-judgement={turn.judgement}>
            {turn.cardId ? getCard(turn.cardId).emoji : '😬'}
          </span>
        ))}
      </div>

      {row.best && (
        <div className="recap__best">
          {/* `best` only ever comes from a turn that scored, and a turn that
              scored was a card being played. */}
          best: {getCard(row.best.cardId!).name} +{row.best.aura}
          {row.bestStreak >= 2 && ` · PERFECT ×${row.bestStreak}`}
        </div>
      )}
    </div>
  )
}

export function ResultScreen({ winner, reason }: Props) {
  // recap() builds a new array every call, so it is derived from a stable
  // selector rather than being one — a selector that allocates spins forever.
  const match = useGame((s) => s.match)
  const rematch = useGame((s) => s.rematch)
  const toTitle = useGame((s) => s.toTitle)

  const rows = recap(match)
  const winnerName = winner === null ? '' : match.players[winner].name

  return (
    <div className="screen screen--result">
      <div className="result__reason">{reason === 'mogged' ? 'MOGGED' : 'OUT OF MOVES'}</div>
      <h2 className="result__winner">{winner === null ? 'DEAD HEAT' : `${winnerName} WINS`}</h2>

      <div className="recap">
        {rows.map((row) => (
          <Row key={row.player} row={row} won={row.player === winner} />
        ))}
      </div>

      <div className="result__actions">
        <button className="btn" onPointerDown={rematch}>
          REMATCH
        </button>
        <button className="btn btn--ghost" onPointerDown={toTitle}>
          TITLE
        </button>
      </div>
    </div>
  )
}
