import type { Card, QteOutcome } from '../../engine/types'
import { QteControl } from './QteControl'
import { QteLanes } from './QteLanes'
import { QteOrder } from './QteOrder'
import { QtePaths } from './QtePaths'
import { QteSpeed } from './QteSpeed'
import { QteTiming } from './QteTiming'

interface Props {
  card: Card
  startedAt: number
  /** Per-play random number in [0, 1); shuffles the QTE so it is never rote. */
  variation: number
  onResult: (outcome: QteOutcome) => void
}

/**
 * One seam for every minigame. Switched on `game` rather than `kind`: two cards
 * can share a kind — which is what freshness reads — and still be completely
 * different things to play.
 */
export function QtePanel({ card, startedAt, variation, onResult }: Props) {
  const shared = { card, startedAt, variation, onResult }

  switch (card.qte.game) {
    case 'sweep':
      return <QteTiming {...shared} params={card.qte} />
    case 'lanes':
      return <QteLanes {...shared} params={card.qte} />
    case 'mash':
      return <QteSpeed {...shared} params={card.qte} />
    case 'order':
      return <QteOrder {...shared} params={card.qte} />
    case 'zone':
      return <QteControl {...shared} params={card.qte} />
    case 'paths':
      return <QtePaths {...shared} params={card.qte} />
  }
}
