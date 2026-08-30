import { useEffect, useRef } from 'react'
import type { Run } from './run'

interface Props {
  run: Run
  /** What one chance is called on this card: "TAPS", "NOTES", "NUMBERS". */
  unit: string
}

/**
 * What the card is asking for, and how far past it you are.
 *
 * Every gesture is scored the same way now — clear the bar to score, answer
 * everything the card holds without scraping any of it to be flawless — but
 * until this existed none of them said so. You were told a number to reach and
 * left to guess both what the extra taps were doing and why a clean-looking run
 * came back as a GOOD.
 *
 * Two marks on one track: the bar you have to clear, and the point where the
 * card runs out of chances. The fill runs past the first toward the second.
 *
 * Nothing here goes through React state. The widgets already run their own
 * frame loops and a re-render per tap would fight them, so the loop calls
 * `paint` and this writes to the DOM directly.
 */
export function QteMeter({ run, unit }: Props) {
  const fillRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const bar = run.total
  const held = run.chances

  useEffect(() => {
    let raf = 0
    const loop = () => {
      // The count is what has actually landed, not what has been attempted:
      // a fumbled tap is not progress toward the bar.
      if (countRef.current) countRef.current.textContent = String(run.ledger.successes)
      if (fillRef.current) {
        // Against everything the card holds, so the two marks below sit where
        // the fill will actually reach them.
        const share = Math.min(1, Math.max(0, run.net / held))
        fillRef.current.style.transform = `scaleX(${share})`
      }
      if (rootRef.current) {
        // Every one of these is the engine's own answer rather than the
        // meter's reading of the same ledger. Counting `successes - mistakes`
        // here weighed a scrape the same as a clean hit, so a run that scraped
        // its way to the bar showed as cleared until the card ended and the
        // score sheet said MISS.
        rootRef.current.dataset.cleared = String(run.cleared)
        // Flawless is still on the table only while nothing has been scraped
        // or dropped, which is the state the sweep's yellow zone takes away.
        rootRef.current.dataset.flawless = String(run.flawless)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [run, bar, held])

  return (
    <div className="meter" ref={rootRef} data-cleared="false" data-flawless="true">
      <div className="meter__track">
        <div ref={fillRef} className="meter__fill" />
        <div className="meter__mark" style={{ left: `${(bar / held) * 100}%` }} />
      </div>
      <div className="meter__legend">
        <b>
          <span ref={countRef}>0</span> {unit}
        </b>
        <em>
          {bar} TO SCORE · ALL {held} CLEAN TO BE FLAWLESS
        </em>
      </div>
    </div>
  )
}
