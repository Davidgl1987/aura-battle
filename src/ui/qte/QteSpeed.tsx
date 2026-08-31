import { useEffect, useRef } from 'react'
import { now, stamp } from '../../state/store'
import type { Card, QteOutcome, SpeedParams } from '../../engine/types'
import { useI18n } from '../../i18n'
import { PadsBoard } from './boards'
import { padLabel } from './speed'
import { useRun } from './run'
import { QteMeter } from './QteMeter'
import { useArming } from './arming'
import { countsAsTap } from './speed'

interface Props {
  card: Card
  params: SpeedParams
  startedAt: number
  /** Unused: a mash has no path to learn. Kept so every widget shares a shape. */
  variation?: number
  onResult: (outcome: QteOutcome) => void
}




export function QteSpeed({ card, params, startedAt, onResult }: Props) {
  const { t } = useI18n()
  const run = useRun(card, onResult)
  const landed = useRef(0)
  const lastZone = useRef<number | null>(null)
  const arming = useArming(startedAt)

  const rootRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<HTMLElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const t = now()
      const armedAt = arming.resolve(t)
      const left = armedAt === null ? 1 : 1 - (t - armedAt) / card.durationMs

      if (rootRef.current) rootRef.current.dataset.live = String(armedAt !== null)

      if (armRef.current) {
        armRef.current.textContent = `${(arming.countdown(t) / 1000).toFixed(1)}s`
      }
      if (timeRef.current) timeRef.current.style.transform = `scaleX(${Math.max(0, left)})`
      run.paint(rootRef.current)

      if (armedAt !== null && left <= 0) {
        run.finish()
        return
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [startedAt, card.durationMs, params, arming, run])

  const tap = (zone: number) => (event: React.PointerEvent<HTMLButtonElement>) => {
    // No ceiling: keep going for as long as the animation lasts.
    if (run.done) return
    const t = event.nativeEvent.timeStamp ? stamp(event.nativeEvent.timeStamp) : now()

    // The tap that starts the clock still counts — swallowing your first hit
    // would feel like the game stole it.
    if (arming.armedAt === null) arming.arm(t)

    // Drumming one thumb is not the gesture: the move is a six and a seven,
    // one in each hand, so the same side twice is a beat thrown away.
    if (!countsAsTap(zone, lastZone.current, params.pads)) {
      run.beat('missed')
      event.currentTarget.dataset.dead = 'true'
      window.setTimeout(() => event.currentTarget?.removeAttribute('data-dead'), 120)
      return
    }

    // No clock on a single tap: the gesture is a six and a seven, one in each
    // hand, and the only way to get it wrong is to use the same hand twice.
    landed.current += 1
    lastZone.current = zone
    run.beat('clean')
  }

  return (
    <div className="qte" ref={rootRef} data-live="false">
      <div className="qte__title">
        {card.emoji} {card.name}
        <em className="qte__hint-grab">
          {params.pads === 1 ? t('qte.start.mash') : t('qte.start.mashPads')}{' '}
          <b ref={armRef} className="qte__count" />
        </em>
        <em className="qte__hint-live">
          {params.pads === 1
            ? t('qte.live.mash')
            : params.pads === 2
              ? t('qte.live.mashAlternate')
              : t('qte.live.mashWalk')}
        </em>
      </div>

      <div className="qte__timer">
        <div ref={timeRef} className="qte__timer-fill" />
      </div>

      <QteMeter run={run} unit={t('qte.unit.taps')} />

      <PadsBoard params={params} label={padLabel} onPad={tap} />
    </div>
  )
}
