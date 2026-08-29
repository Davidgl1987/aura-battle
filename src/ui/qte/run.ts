import { useEffect, useRef, useState } from 'react'
import { play } from '../../audio/engine'
import { QTE_TICK_MS } from '../../engine/balance'
import { EMPTY, accuracyOf, opportunities, record, settle, tickBeat } from '../../engine/qte'
import type { Beat, Ledger } from '../../engine/qte'
import type { Card, QteOutcome } from '../../engine/types'

/**
 * The running score of one gesture, shared by all six widgets.
 *
 * A gesture is no longer a verdict taken at one moment — it runs for the whole
 * animation and every opportunity inside it either pays or costs. All a widget
 * has to do is say what just happened; this keeps the ledger, drives the sound
 * and the feedback, and settles at the end.
 *
 * Nothing here goes through React state: the widgets already run their own
 * frame loops and a re-render per tap would fight them. `paint` writes the
 * running state onto the root element and CSS does the rest.
 */
export interface Run {
  readonly ledger: Ledger
  /** Chances the card offers in total. */
  readonly total: number
  /** False the moment anything is fumbled. */
  readonly perfect: boolean
  /** 0..1 so far, for the performance bar. */
  readonly accuracy: number
  readonly done: boolean

  /** One discrete opportunity: a tap, a note, a number. */
  beat(beat: Beat): void
  /**
   * A stretch of a continuous gesture. Called on a fixed clock rather than per
   * frame, and told how much of that stretch was actually held — a single
   * dropped frame must not read as a slip.
   */
  hold(insideMs: number, tickMs?: number): void
  /** Writes the running state onto the root, for CSS to show. */
  paint(root: HTMLElement | null): void
  /** Settles the ledger and reports. Only the first call counts. */
  finish(): void
}

export function useRun(card: Card, onResult: (outcome: QteOutcome) => void): Run {
  // The callback changes identity every render; the run is created once.
  const report = useRef(onResult)
  useEffect(() => {
    report.current = onResult
  })

  const [run] = useState<Run>(() => {
    let ledger = EMPTY
    let done = false
    const total = opportunities(card)

    const announce = (beat: Beat) => {
      // The first fumble is the whole difference between PERFECT and GOOD, so
      // it gets a sound of its own rather than a quieter version of a hit.
      if (beat === 'missed') play(ledger.mistakes === 0 ? 'godAuraLost' : 'dead')
      else play(beat === 'clean' ? 'tap' : 'dead')
    }

    return {
      get ledger() {
        return ledger
      },
      total,
      get perfect() {
        return ledger.mistakes === 0
      },
      get accuracy() {
        return accuracyOf(ledger, total)
      },
      get done() {
        return done
      },

      beat(beat) {
        if (done) return
        ledger = record(ledger, beat)
        announce(beat)
      },

      hold(insideMs, tickMs = QTE_TICK_MS) {
        if (done) return
        const beat = tickBeat(insideMs, tickMs)
        ledger = record(ledger, beat)
        // Continuous gestures tick four times a second; a sound on every one
        // of them is a buzz, so only the slips speak.
        if (beat === 'missed') announce(beat)
      },

      paint(root) {
        if (!root) return
        root.dataset.perfect = String(ledger.mistakes === 0)
        root.dataset.slipped = String(ledger.mistakes > 0)
        root.style.setProperty('--acc', accuracyOf(ledger, total).toFixed(3))
        root.style.setProperty('--taken', String(ledger.taken))
      },

      finish() {
        if (done) return
        done = true
        report.current(settle(card, ledger))
      },
    }
  })

  return run
}

/**
 * When each of `total` opportunities falls across a gesture that speeds up.
 *
 * The gaps shrink by the same curve the CPU's odds tighten on, so a card that
 * opens comfortable and closes flat out is the same card for both of them.
 * Returned as absolute offsets from the moment the gesture went live.
 */
export function schedule(durationMs: number, total: number, ramp: number): number[] {
  // Each gap is proportional to 1/ramp at its own point, normalised so the
  // last opportunity lands exactly at the end.
  const weights = Array.from({ length: total }, (_, i) =>
    total <= 1 ? 1 : 1 / (1 + (ramp - 1) * (i / (total - 1))),
  )
  const sum = weights.reduce((a, b) => a + b, 0)
  let at = 0
  return weights.map((w) => {
    at += (w / sum) * durationMs
    return at
  })
}
