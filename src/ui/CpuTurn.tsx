import { useEffect, useRef } from 'react'
import { KIND_LABEL, TIER_LABEL } from '../engine/cards'
import type { Beat } from '../engine/perform'
import { freshnessOf } from '../engine/scoring'
import type { Card, PlayedCard, PlayerState } from '../engine/types'
import { now } from '../state/store'

interface Props {
  rival: PlayerState
  /** The card being performed, or null while they are still deciding. */
  card: Card | null
  /** When the current gesture started, for the progress bar. */
  startedAt: number
  /** What the last card played was, for the freshness tag. */
  lastPlayed: PlayedCard | null
  /** How the attempt goes, beat by beat. Absent until the gesture starts. */
  beats: Beat[] | null
}

/**
 * The console during the rival's turn. They are not playing a QTE, so there is
 * no widget to show — what there is instead is what a player across the table
 * would actually be able to see: which card came out, whether it answers the
 * one on the table, and how far through the gesture they are.
 *
 * The bar is written straight to the DOM in its own frame loop, like the
 * countdown and the QTE cursor. Nothing that ticks goes through React state.
 */
export function CpuTurn({ rival, card, startedAt, lastPlayed, beats }: Props) {
  const fillRef = useRef<HTMLDivElement>(null)
  const beatsRef = useRef<HTMLDivElement>(null)

  /**
   * The bar and the beats are written straight to the DOM in one frame loop,
   * like the countdown and the QTE cursor: nothing that ticks goes through
   * React state.
   */
  useEffect(() => {
    if (fillRef.current) fillRef.current.style.transform = 'scaleX(0)'
    for (const pip of beatsRef.current?.children ?? []) {
      ;(pip as HTMLElement).dataset.beat = 'waiting'
    }
    // `Infinity` while the card is on screen but not being performed yet.
    if (!card || !Number.isFinite(startedAt)) return

    let raf = 0
    const loop = () => {
      const p = Math.min(1, Math.max(0, (now() - startedAt) / card.durationMs))
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`

      // Each beat lands on its own share of the gesture, so the strip resolves
      // in time with the body doing the move rather than all at the end.
      const pips = beatsRef.current?.children
      if (pips && beats) {
        for (let i = 0; i < pips.length; i++) {
          const landed = p >= (i + 1) / pips.length
          const pip = pips[i] as HTMLElement
          const state = landed ? beats[i] : 'waiting'
          if (pip.dataset.beat !== state) pip.dataset.beat = state
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [card, startedAt, beats])

  if (!card) {
    return (
      <div className="cpu" data-state="thinking">
        <div className="cpu__who">{rival.name} IS COOKING</div>
        <div className="cpu__dots" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="cpu__left">{rival.remaining.length} cards left</div>
      </div>
    )
  }

  const fresh = freshnessOf(card, lastPlayed)

  return (
    <div className="cpu" data-state="performing">
      <div className="cpu__who">{rival.name} PLAYS</div>
      <div className="cpu__card" data-kind={card.kind} data-fresh={fresh}>
        <span className="cpu__emoji">{card.emoji}</span>
        <span className="cpu__name">{card.name}</span>
        <span className="cpu__meta">
          {KIND_LABEL[card.kind]} · {TIER_LABEL[card.difficulty]} · {card.baseAura} aura
        </span>
        <span className="cpu__fresh">{fresh}</span>
      </div>
      {/* What they are actually doing with it. A rival never touches the
          glass, so without this a MISS is a number that arrives out of
          nowhere — here it is a beat you watch them drop. */}
      {beats && (
        <div className="cpu__beats" ref={beatsRef} aria-hidden>
          {beats.map((_, i) => (
            <span key={i} className="cpu__beat" data-beat="waiting" />
          ))}
        </div>
      )}
      <div className="cpu__track">
        <div ref={fillRef} className="cpu__fill" />
      </div>
    </div>
  )
}

