import { MOMENTUM_MAX, STREAK_MIN } from '../engine/balance'
import { getCharacter } from '../engine/characters'
import type { PlayerState } from '../engine/types'

/**
 * `delta` is what the play just did to this player's momentum, or null when it
 * was not their turn. A bar sliding a few percent goes unnoticed in the middle
 * of a battle, so the change is spelled out beside it.
 */
export function MomentumMeter({
  player,
  delta = null,
}: {
  player: PlayerState
  delta?: number | null
}) {
  const character = getCharacter(player.characterId)
  const pct = (player.momentum / MOMENTUM_MAX) * 100

  return (
    <div className="momentum" data-god={player.godAura}>
      <div className="momentum__label">
        <span>{player.godAura ? '🔥 GOD AURA' : `${player.name} MOMENTUM`}</span>
        {delta !== null && delta !== 0 && (
          <span className="momentum__delta" data-sign={delta < 0 ? 'down' : 'up'}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
        {player.perfectStreak >= STREAK_MIN && (
          <span className="momentum__streak" key={player.perfectStreak}>
            PERFECT ×{player.perfectStreak}
          </span>
        )}
      </div>
      <div className="momentum__track">
        <div
          className="momentum__fill"
          style={{ width: `${pct}%`, background: player.godAura ? undefined : character.color }}
        />
      </div>
    </div>
  )
}
