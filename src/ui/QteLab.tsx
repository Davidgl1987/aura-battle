import { useEffect, useState } from 'react'
import { CARDS, KIND_LABEL, getCard, TIER_LABEL } from '../engine/cards'
import { now } from '../state/store'
import type { Card, QteOutcome } from '../engine/types'
import { QtePanel } from './qte/QtePanel'

/**
 * Start on a real frame, not on mount: if the tab was hidden the clock ran on
 * without us and the QTE would open with its window already spent.
 */
function QteRun({ card, onResult }: { card: Card; onResult: (outcome: QteOutcome) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [variation] = useState(() => Math.random())

  useEffect(() => {
    const raf = requestAnimationFrame(() => setStartedAt(now()))
    return () => cancelAnimationFrame(raf)
  }, [])

  if (startedAt === null) return <div className="lab__wait">GET READY…</div>
  return (
    <QtePanel card={card} startedAt={startedAt} variation={variation} onResult={onResult} />
  )
}

/**
 * Dev-only QTE range (`?qte` in the URL). Repeat one card's QTE on the phone
 * as many times as it takes to get the windows right, without playing a whole
 * battle to reach it.
 */
export function QteLab({ initialCardId }: { initialCardId: string }) {
  const [cardId, setCardId] = useState(initialCardId)
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<QteOutcome | null>(null)

  const card = getCard(cardId)

  const restart = () => {
    setResult(null)
    setRun((r) => r + 1)
  }

  const swap = (id: string) => {
    setResult(null)
    setCardId(id)
  }

  return (
    <div className="screen screen--lab">
      <header className="lab__head">
        QTE RANGE · {KIND_LABEL[card.kind]} · {TIER_LABEL[card.difficulty]} · {card.durationMs}ms
      </header>

      <div className="lab__picker">
        {CARDS.map((c) => (
          <button
            key={c.id}
            className="chip"
            data-kind={c.kind}
            data-spent={c.id !== cardId}
            onPointerDown={() => swap(c.id)}
          >
            {c.emoji}
          </button>
        ))}
      </div>

      <main className="stage">
        {result === null ? (
          <QteRun key={`${cardId}:${run}`} card={card} onResult={setResult} />
        ) : (
          <div className="splash" data-judgement={result.judgement}>
            <div className="splash__judgement">{result.judgement}</div>
            {/* The whole point of the range is tuning, so it shows the ledger
                rather than just the verdict it produced. */}
            <div className="lab__metrics">
              {(result.metrics.accuracy * 100).toFixed(0)}% · {result.metrics.successes} landed ·{' '}
              {result.metrics.mistakes} fumbled · {result.score} aura
            </div>
          </div>
        )}
      </main>

      <button className="btn btn--confirm" onPointerDown={restart}>
        {result === null ? 'RESTART' : 'AGAIN'}
      </button>
    </div>
  )
}
