import { GOD_AURA_MULT, MOGGED_THRESHOLD, OUTAURA_RATIO, STREAK_MIN } from '../engine/balance'

/**
 * Every label the game will ever shout at you, in one place. The resolve screen
 * explains a score while it is on the table, but only in passing and only for
 * the lines that fired — this is where you look up the one you did not catch.
 */
const GLOSSARY: { group: string; terms: [label: string, meaning: string][] }[] = [
  {
    group: 'HOW A PLAY SCORES',
    terms: [
      ['PERFECT / GOOD / MISS', 'How cleanly you hit the gesture. A MISS costs you aura.'],
      ['FRESH MOVE', 'You answered with a different kind of gesture than the last one played.'],
      [
        'HARD MOVE',
        'Every card is worth one, and a HARD card is worth double a NORMAL one. Hard cards pay more and miss more.',
      ],
      [
        `PERFECT STREAK ×${STREAK_MIN}+`,
        'PERFECTs in a row, yours only. Each link is worth more than the last; anything short of a PERFECT breaks it.',
      ],
      [
        "OUTAURA'D",
        `Your play beat the rival's last one by ${OUTAURA_RATIO}× or better. You cannot out-aura someone who just started, or who missed.`,
      ],
    ],
  },
  {
    group: 'FRESHNESS',
    terms: [
      ['FRESH', 'A different kind than the last move. Pays a bonus and feeds momentum.'],
      ['NEUTRAL', 'Same kind, different card. No bonus, and momentum slips.'],
      ['STALE', 'The very same card again. No bonus, and momentum drops hard.'],
    ],
  },
  {
    group: 'MOMENTUM',
    terms: [
      [
        'THE METER',
        'Fills on PERFECTs and GOODs, on varying your answers, on hard cards, and on streaks. Repeating yourself drains it.',
      ],
      [
        `🔥 GOD AURA ×${GOD_AURA_MULT}`,
        'A full meter sets you alight and doubles everything you score. A MISS puts it out.',
      ],
    ],
  },
  {
    group: 'THE BATTLE',
    terms: [
      [
        'THE BAR',
        `Shared. It leans toward whoever is ahead, and shoving it all the way to their end is MOGGED — an instant win, ${MOGGED_THRESHOLD} aura clear.`,
      ],
      [
        '😬 LOST COMPOSURE',
        'You ran out of time choosing. The turn is spent and your momentum is wiped — but your cards are all still yours.',
      ],
      ['OUT OF MOVES', 'Both of you have taken every turn. Whoever holds the bar wins.'],
    ],
  },
]

export function Glossary() {
  return (
    <div className="glossary">
      {GLOSSARY.map(({ group, terms }) => (
        <section key={group} className="glossary__group">
          <h3 className="glossary__heading">{group}</h3>
          <dl className="glossary__list">
            {terms.map(([label, meaning]) => (
              <div key={label} className="glossary__term">
                <dt>{label}</dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
