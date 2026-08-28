import { getCharacter } from '../engine/characters'
import { barPosition } from '../engine/scoring'
import { useBalance, useGame } from '../state/store'

/**
 * The shared aura bar. Positive balance means player 0 is pushing the divider
 * to the right, and pushing it all the way to the end is the instant win — so
 * the bar needs no notches to explain itself. Each side wears its fighter's
 * colour so "who is who" reads the same on every screen.
 */
export function AuraBar() {
  const balance = useBalance()
  // Selectors must return a stable value: building an array here would hand
  // React a new snapshot on every render and spin forever.
  const p0 = useGame((s) => s.match.players[0].name)
  const p1 = useGame((s) => s.match.players[1].name)
  const c0 = useGame((s) => getCharacter(s.match.players[0].characterId).color)
  const c1 = useGame((s) => getCharacter(s.match.players[1].characterId).color)
  const position = barPosition(balance)
  const fill = 50 + position * 50
  // Warn the player being run over before the bar actually runs out.
  const edge = Math.abs(position) > 0.72 ? (position > 0 ? '0' : '1') : undefined

  return (
    <div className="aura">
      <span className="aura__name" style={{ color: c0 }}>
        {p0}
      </span>
      <div className="aura__track" style={{ background: c1 }} data-edge={edge}>
        <div className="aura__fill" style={{ width: `${fill}%`, background: c0 }} />
        <div className="aura__divider" style={{ left: `${fill}%` }} />
      </div>
      <span className="aura__name" style={{ color: c1 }}>
        {p1}
      </span>
    </div>
  )
}
