import { getCard } from '../engine/cards'
import { getCharacter } from '../engine/characters'
import { playerColor } from '../engine/match'
import { recap, type PlayerRecap } from '../engine/recap'
import { getRival, nextRival } from '../engine/rivals'
import { battleStats } from '../engine/stats'
import { useGame } from '../state/store'
import { isRivalUnlocked, useProgress } from '../state/useProgress'
import { ObjectiveList } from './solo/ObjectiveList'
import type { PlayerId } from '../engine/types'

interface Props {
  winner: PlayerId | null
  reason: 'mogged' | 'moves'
}

function Row({ row, won }: { row: PlayerRecap; won: boolean }) {
  const player = useGame((s) => s.match.players[row.player])
  const character = getCharacter(player.characterId)

  return (
    <div className="recap__row" data-won={won}>
      <div className="recap__who">
        <span style={{ color: playerColor(player) }}>
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

/**
 * The headline, in the words the game uses about itself. A win by MOGGED is
 * not the same event as a win on moves, and the screen should say which.
 */
function headline(winner: PlayerId | null, reason: 'mogged' | 'moves', rivalName: string): string {
  if (winner === null) return 'DEAD HEAT'
  if (winner === 0) return reason === 'mogged' ? `YOU MOGGED ${rivalName}` : `YOU BEAT ${rivalName}`
  return reason === 'mogged' ? `${rivalName} MOGGED YOU` : `${rivalName} WINS`
}

/**
 * Everything the solo battle was worth, and one obvious thing to do next. The
 * rewards were banked by the store when the match ended — this reads the
 * receipt rather than writing one.
 */
function SoloResult({ winner, reason }: Props) {
  const match = useGame((s) => s.match)
  const opponentId = useGame((s) => s.opponentId)!
  const claimed = useGame((s) => s.claimed)
  const rematch = useGame((s) => s.rematch)
  const go = useGame((s) => s.go)
  const startBattle = useGame((s) => s.startBattle)
  const progress = useProgress()

  const rival = getRival(opponentId)
  const stats = battleStats(match)
  const after = nextRival(opponentId)
  const canAdvance = after !== null && isRivalUnlocked(progress, after.id)

  // Something worth coming back for: an objective still open against a rival
  // you have already beaten. That is what makes the rematch the loud button.
  const leftBehind = (claimed?.banked ?? []).some((done, i) => !done && !claimed?.met[i])
  const primaryIsNext = canAdvance && !leftBehind

  const mine = stats.totalAura[0]
  const theirs = stats.totalAura[1]
  const gap = mine - theirs

  return (
    <div className="screen screen--result screen--result-solo">
      <div className="result__reason" data-reason={reason}>
        {reason === 'mogged' ? 'MOGGED' : 'OUT OF MOVES'}
      </div>
      <h2 className="result__winner" style={{ color: winner === 0 ? 'var(--gold)' : 'var(--muted)' }}>
        {headline(winner, reason, rival.name)}
      </h2>

      <div className="tally">
        <div className="tally__aura">
          {mine > 0 ? '+' : ''}
          {mine.toLocaleString('en-US')} <span>AURA</span>
        </div>
        <div className="tally__gap" data-ahead={gap >= 0}>
          {gap >= 0 ? '+' : ''}
          {gap.toLocaleString('en-US')} vs {rival.name}
        </div>
        <div className="tally__badges">
          {stats.bestStreak[0] >= 2 && (
            <span className="badge">PERFECT STREAK ×{stats.bestStreak[0]}</span>
          )}
          {stats.godAuraReached[0] && <span className="badge badge--god">🔥 GOD AURA</span>}
          {stats.outauraCount[0] > 0 && (
            <span className="badge">OUTAURA'D ×{stats.outauraCount[0]}</span>
          )}
          {stats.missCount[0] === 0 && stats.lostComposureCount[0] === 0 && (
            <span className="badge">CLEAN SHEET</span>
          )}
        </div>
      </div>

      <div className="result__objectives">
        <h3 className="result__heading">OBJECTIVES</h3>
        <ObjectiveList
          objectives={rival.objectives}
          banked={claimed?.banked ?? [false, false, false]}
          met={claimed?.met}
          fresh={claimed?.fresh}
        />
      </div>

      {/* Four ways on, stacked full width so the two that restart a battle
          carry the same weight — picking between them is the decision, and a
          narrow REMATCH beside a wide NEXT was making it for the player. */}
      <div className="result__actions">
        {canAdvance && (
          <button
            className="btn btn--big"
            data-primary={primaryIsNext}
            onPointerDown={() => startBattle({ mode: 'solo', opponentId: after.id })}
          >
            NEXT · {after.name}
          </button>
        )}
        <button className="btn btn--big" data-primary={!primaryIsNext} onPointerDown={rematch}>
          REMATCH
        </button>
        {/* Straight into the deck: losing usually means you brought the wrong
            five, and sending the player home to work that out is a detour. */}
        <button className="btn btn--big btn--flat" onPointerDown={() => go('collection')}>
          CHANGE YOUR DECK
        </button>
        <button className="btn btn--big btn--flat" onPointerDown={() => go('home')}>
          HOME
        </button>
      </div>
    </div>
  )
}

export function ResultScreen({ winner, reason }: Props) {
  // recap() builds a new array every call, so it is derived from a stable
  // selector rather than being one — a selector that allocates spins forever.
  const match = useGame((s) => s.match)
  const mode = useGame((s) => s.mode)
  const opponentId = useGame((s) => s.opponentId)
  const rematch = useGame((s) => s.rematch)
  const toTitle = useGame((s) => s.toTitle)

  if (mode === 'solo' && opponentId) return <SoloResult winner={winner} reason={reason} />

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
          HOME
        </button>
      </div>
    </div>
  )
}
