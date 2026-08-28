import { Suspense, lazy, useState } from 'react'
import { getCard } from '../../engine/cards'
import { useI18n } from '../../i18n'
import { RIVALS, getRival, rivalIndex } from '../../engine/rivals'
import { useGame } from '../../state/store'
import {
  bankedFor,
  currentRival,
  isRivalUnlocked,
  useProgress,
} from '../../state/useProgress'
import { ObjectiveList } from './ObjectiveList'

const RivalShowcase = lazy(() =>
  import('../../scene/Showcase').then((m) => ({ default: m.RivalShowcase })),
)

/**
 * One screen, no detail page. The rival owns the stage, the strip along the
 * top is how you move between them, and everything you would open a second
 * screen to read is already in the sheet at the bottom.
 */
export function RivalSelectScreen() {
  const { t } = useI18n()
  const go = useGame((s) => s.go)
  const startBattle = useGame((s) => s.startBattle)
  const progress = useProgress()

  // Opens on whoever is next rather than at the top of the list: coming back
  // from a win and having to scroll to the new rival is a chore.
  const [selectedId, setSelectedId] = useState(() => currentRival(progress))

  const rival = getRival(selectedId)
  const unlocked = isRivalUnlocked(progress, selectedId)
  const banked = bankedFor(progress, selectedId)
  const blockedBy = RIVALS[rivalIndex(selectedId) - 1]
  const signature = getCard(rival.signatureCardId)

  return (
    <div className="screen screen--rivals" style={{ '--who': rival.look.color } as React.CSSProperties}>
      <Suspense fallback={null}>
        <RivalShowcase rival={rival} />
      </Suspense>

      <header className="rivals__top">
        <button className="back" onPointerDown={() => go('home')}>
          ‹ {t('common.home')}
        </button>

        <div className="roster">
          {RIVALS.map((r) => {
            const open = isRivalUnlocked(progress, r.id)
            const done = bankedFor(progress, r.id)
            return (
              <button
                key={r.id}
                className="roster__pick"
                data-selected={r.id === selectedId}
                data-locked={!open}
                style={{ '--who': r.look.color } as React.CSSProperties}
                onPointerDown={() => setSelectedId(r.id)}
                aria-label={open ? r.name : t('rivals.lockedAria', { name: r.name })}
              >
                <span className="roster__face">{open ? r.name.slice(0, 1) : '🔒'}</span>
                <span className="roster__done">
                  {done.filter(Boolean).length}/{done.length}
                </span>
              </button>
            )
          })}
        </div>
      </header>

      <div className="rivals__sheet">
        <div className="rival__id">
          <h2 className="rival__name">{rival.name}</h2>
          <span className="rival__dots" aria-label={t('rivals.difficulty', { n: rival.difficulty })}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="rival__dot" data-on={n <= rival.difficulty} />
            ))}
          </span>
        </div>
        <p className="rival__tagline">{rival.tagline}</p>

        {unlocked ? (
          <>
            <ObjectiveList objectives={rival.objectives} banked={banked} />
            {/* The card they are about to perform at you, named — the fighter
                behind this sheet is already warming up with it. */}
            <p className="rival__signature">
              {t('rivals.plays', { card: `${signature.emoji} ${signature.name}` })}
            </p>
            <button
              className="btn btn--big btn--confirm"
              onPointerDown={() => startBattle({ mode: 'solo', opponentId: rival.id })}
            >
              {t('rivals.battle')}
            </button>
          </>
        ) : (
          <div className="rival__locked">
            <p>{t('rivals.lockedBy', { name: blockedBy?.name ?? '' })}</p>
            <button className="btn btn--ghost" onPointerDown={() => setSelectedId(blockedBy.id)}>
              {t('rivals.goTo', { name: blockedBy?.name ?? '' })}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
