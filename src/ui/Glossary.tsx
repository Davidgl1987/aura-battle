import { useI18n, type TextKey } from '../i18n'

/**
 * What every word on the score sheet means, grouped the way a player runs into
 * them: how a play scores, then what freshness is, then momentum, then how a
 * battle ends.
 *
 * Keys rather than sentences: the words live in `i18n/`, so the same list
 * reads in whichever language is on without a second copy of it here.
 */
const GROUPS: { heading: TextKey; terms: [term: TextKey, text: TextKey][] }[] = [
  {
    heading: 'glossary.scoring',
    terms: [
      ['glossary.judgement', 'glossary.judgementText'],
      ['glossary.freshMove', 'glossary.freshMoveText'],
      ['glossary.hardMove', 'glossary.hardMoveText'],
      ['glossary.streak', 'glossary.streakText'],
      ['glossary.outaura', 'glossary.outauraText'],
    ],
  },
  {
    heading: 'glossary.freshness',
    terms: [
      ['glossary.fresh', 'glossary.freshText'],
      ['glossary.neutral', 'glossary.neutralText'],
      ['glossary.stale', 'glossary.staleText'],
    ],
  },
  {
    heading: 'glossary.momentum',
    terms: [
      ['glossary.meter', 'glossary.meterText'],
      ['glossary.godAura', 'glossary.godAuraText'],
    ],
  },
  {
    heading: 'glossary.battle',
    terms: [
      ['glossary.bar', 'glossary.barText'],
      ['glossary.mogged', 'glossary.moggedText'],
      ['glossary.lostComposure', 'glossary.lostComposureText'],
      ['glossary.outOfMoves', 'glossary.outOfMovesText'],
    ],
  },
]

export function Glossary() {
  const { t } = useI18n()

  return (
    <div className="glossary">
      {GROUPS.map(({ heading, terms }) => (
        <section key={heading} className="glossary__group">
          <h3 className="glossary__heading">{t(heading)}</h3>
          <dl className="glossary__list">
            {terms.map(([term, text]) => (
              <div key={term} className="glossary__term">
                <dt>{t(term)}</dt>
                <dd>{t(text)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
