import { rewardEmoji } from '../../engine/rewards'
import type { Objective } from '../../engine/objectives'
import { useI18n } from '../../i18n'
import { objectiveText, rewardText } from '../labels'

interface Props {
  objectives: readonly Objective[]
  /** Which are already banked, in the rival's own order. */
  banked: boolean[]
  /** Which were met in the battle just played. Absent before one. */
  met?: boolean[]
  /** Which paid out just now, for the glow on the results screen. */
  fresh?: boolean[]
}

/**
 * A rival's three, with what each one pays. The same list on the select screen
 * and on the results screen: the promise and the receipt should not be two
 * different-looking things.
 */
export function ObjectiveList({ objectives, banked, met, fresh }: Props) {
  const i18n = useI18n()

  return (
    <ul className="objectives">
      {objectives.map((objective, i) => {
        const done = banked[i] || met?.[i]
        return (
          <li
            key={i}
            className="objective"
            data-done={done}
            data-fresh={fresh?.[i] ?? false}
            // Staggered, so the three land one after another rather than all at
            // once — the reward you just won gets a beat of its own.
            style={{ '--i': i } as React.CSSProperties}
          >
            <span className="objective__tick" aria-hidden>
              {done ? '✓' : '○'}
            </span>
            <span className="objective__what">{objectiveText(objective.check, i18n)}</span>
            <span className="objective__reward">
              <span className="objective__emoji" aria-hidden>
                {rewardEmoji(objective.reward)}
              </span>
              {rewardText(objective.reward, i18n)}
            </span>
            {fresh?.[i] && <span className="objective__new">{i18n.t('objective.new')}</span>}
          </li>
        )
      })}
    </ul>
  )
}
