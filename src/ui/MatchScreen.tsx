import { Suspense, lazy, useEffect } from 'react'
import { getCard } from '../engine/cards'
import type { QteGame } from '../engine/types'
import { getCharacter } from '../engine/characters'
import { outauraTarget, playerColor } from '../engine/match'
import { getRival } from '../engine/rivals'
import { useI18n } from '../i18n'
import { kindLabel } from './labels'
import { now, useGame } from '../state/store'
import { cpuPerformance, useCpuTurn } from '../state/useCpuTurn'
import { CpuTurn } from './CpuTurn'
import { AuraBar } from './AuraBar'
import { Countdown } from './Countdown'
import { DeckStrip } from './DeckStrip'
import { HandoffScreen } from './HandoffScreen'
import { Hand } from './Hand'
import { JudgementSplash } from './JudgementSplash'
import { MomentumMeter } from './MomentumMeter'
import { PauseScreen } from './PauseScreen'
import { PlayedStrip } from './PlayedStrip'
import { ResultScreen } from './ResultScreen'
import { SlideToPass } from './SlideToPass'
import { QtePanel } from './qte/QtePanel'
import { QteTutorial } from './qte/QteTutorial'
import { useProgress } from '../state/useProgress'

/**
 * three.js is most of the download, and none of it is needed for the title or
 * the deck builder. Split here and it arrives while the players are still
 * picking cards. The setup screen starts that fetch early.
 */
const StageScene = lazy(() =>
  import('../scene/StageScene').then((m) => ({ default: m.StageScene })),
)

export function MatchScreen() {
  const i18n = useI18n()
  const { t, n } = i18n
  const match = useGame((s) => s.match)
  const dispatch = useGame((s) => s.dispatch)
  const paused = useGame((s) => s.paused)
  const setPaused = useGame((s) => s.setPaused)
  const tutorial = useGame((s) => s.tutorial)
  const showTutorial = useGame((s) => s.showTutorial)
  const dismissTutorial = useGame((s) => s.dismissTutorial)
  const seenTutorials = useProgress((s) => s.seenTutorials)
  const markTutorialSeen = useProgress((s) => s.markTutorialSeen)
  const mode = useGame((s) => s.mode)
  const opponentId = useGame((s) => s.opponentId)
  // Plays the rival's turns through the same reducer a thumb drives.
  useCpuTurn()

  const { phase, players, active, lastPlayed, settings } = match
  const player = players[active]
  const rival = players[active === 0 ? 1 : 0]
  const character = getCharacter(player.characterId)
  // Whether the console is waiting for a thumb or watching one play out. The
  // battle itself does not change; only who is answering it.
  const cpuUp = player.controller === 'cpu'

  /**
   * The first time a minigame comes up, stop everything and explain it.
   *
   * Only for a thumb: the rival's turn is watched, not played. And only on the
   * gesture — the same six explanations however many cards are built on them.
   */
  const upcoming = phase.kind === 'qte' && !cpuUp ? getCard(phase.cardId).qte.game : null
  useEffect(() => {
    if (upcoming && !seenTutorials.includes(upcoming)) showTutorial(upcoming)
  }, [upcoming, seenTutorials, showTutorial])
  const solo = mode === 'solo' && opponentId !== null
  const accent = playerColor(player)
  // Derived from the match, not held anywhere: the same question `useCpuTurn`
  // asks, so the strip and the grade cannot come apart.
  const cpuBeats = solo && opponentId ? cpuPerformance(match, getRival(opponentId).strategy) : null

  // While the judgement is on screen the move has already been counted, so
  // showing movesPlayed + 1 there would skip a number.
  const settling = phase.kind === 'resolve' || phase.kind === 'lostComposure'
  const move = Math.min(settling ? player.movesPlayed : player.movesPlayed + 1, settings.deckSize)

  // Only the player who just moved has a momentum change to report.
  const scored = settling ? phase.result : null
  const beat = phase.kind === 'choosing' ? outauraTarget(match) : null

  return (
    <div className="screen screen--match" data-god={player.godAura} data-phase={phase.kind}>
      {/* The stage is the screen now; everything below floats over it. */}
      <Suspense fallback={null}>
        <StageScene />
      </Suspense>

      <header className="topbar">
        <AuraBar />
        <div className="hud">
          <div className="hud__turn">
            <strong style={{ color: accent }}>
              {character.emoji} {player.name}
            </strong>{' '}
            · {t('match.move', { n: move, total: settings.deckSize })}
          </div>
          <div className="hud__last">
            {lastPlayed
              ? t('match.last', {
                  kind: kindLabel(lastPlayed.kind, i18n),
                  card: getCard(lastPlayed.cardId).name,
                })
              : t('match.firstMove')}
          </div>
          {/* Not during a gesture: the QTE widgets run their own clocks and
              would carry on counting behind the overlay. */}
          <button
            className="hud__pause"
            aria-label={t('common.pause')}
            disabled={phase.kind === 'qte'}
            onPointerDown={() => setPaused(true)}
          >
            ❚❚
          </button>
        </div>
        <PlayedStrip match={match} />
        {/* Status belongs with the status. Down in the console these rode up
            over the fighter whenever a tall QTE opened. */}
        <div className="meters">
          {players.map((p) => (
            <MomentumMeter
              key={p.id}
              player={p}
              delta={
                scored?.player === p.id ? scored.momentumAfter - scored.momentumBefore : null
              }
            />
          ))}
        </div>
      </header>

      <div className="focus">
        {phase.kind === 'performIntro' && (
          <div className="stage__intro">{getCard(phase.cardId).emoji}</div>
        )}
        {(phase.kind === 'resolve' || phase.kind === 'lostComposure') && (
          <JudgementSplash result={phase.result} />
        )}
      </div>

      <footer className="console" data-mode={phase.kind}>
        {/* The rival is not holding the phone, so the console reports on them
            instead of waiting for them. The intro is in here too: leaving it
            out emptied the console for a beat between the pick and the
            performance, and the whole panel jumped. */}
        {cpuUp &&
          (phase.kind === 'choosing' ||
            phase.kind === 'performIntro' ||
            phase.kind === 'qte') && (
            <CpuTurn
              rival={player}
              card={phase.kind === 'choosing' ? null : getCard(phase.cardId)}
              // Only the QTE has a gesture running, so only the QTE fills the
              // bar; during the intro it sits at zero.
              startedAt={phase.kind === 'qte' ? phase.startedAt : Infinity}
              lastPlayed={lastPlayed}
              beats={cpuBeats}
            />
          )}

        {!cpuUp && phase.kind === 'choosing' && (
          <>
            <div className="prompt">{t('match.pick', { name: player.name })}</div>
            {/* What the rival just took, and what it costs to top it. The
                OUTAURA'D bonus is unwinnable if you cannot see the bar. */}
            {beat && (
              <div className="beat">
                {t('match.beat', {
                  name: rival.name,
                  took: n(beat.last),
                  needed: n(beat.needed),
                })}
              </div>
            )}
            <Countdown endsAt={phase.endsAt} totalMs={settings.chooseMs} label={t('match.decide')} />
            <Hand
              cards={player.remaining}
              deckSize={settings.deckSize}
              lastPlayed={lastPlayed}
              disabled={false}
              onPick={(cardId) => dispatch({ type: 'SELECT_CARD', cardId, now: now() })}
            />
          </>
        )}

        {/* Held back until the tutorial is dismissed, so the widget's own
            arming clock does not start behind an explanation. */}
        {!cpuUp && phase.kind === 'qte' && tutorial === null && (
          <QtePanel
            card={getCard(phase.cardId)}
            startedAt={phase.startedAt}
            variation={phase.variation}
            onResult={(outcome) => dispatch({ type: 'QTE_RESULT', outcome, now: now() })}
          />
        )}

        {/* The score sheet is the handoff, and it hands over by being dragged
            rather than tapped: the last taps of a long QTE land after it has
            been graded, and a button here would swallow one and skip the turn. */}
        {/* A rival's own score sheet reads itself; see `useCpuTurn`. */}
        {settling && !cpuUp && (
          <div className="pass" style={{ '--i': phase.result.lines.length + 2 } as React.CSSProperties}>
            <span className="pass__lead">
              {match.pendingEnd
                ? t('match.lastMove')
                : solo
                  ? t('match.turnOver')
                  : t('match.passTo')}
            </span>
            {!match.pendingEnd && !solo && (
              <span className="pass__who" style={{ color: playerColor(rival) }}>
                {getCharacter(rival.characterId).emoji} {rival.name}
              </span>
            )}
            {/* Sliding is not only a handover ritual, which is why solo slides
                too. The bill lands the instant a gesture is graded and the last
                taps of a mash are still arriving — a button under them is gone
                before it has been read, and the score sheet with it. Slide is
                the one control a stray finger cannot fire: see `SlideToPass`. */}
            <SlideToPass
              color={match.pendingEnd ? 'var(--gold)' : playerColor(rival)}
              label={
                match.pendingEnd
                  ? t('match.slideResult')
                  : solo
                    ? t('match.slideRival', { name: rival.name })
                    : t('match.slideReady')
              }
              onComplete={() => dispatch({ type: 'READY', now: now() })}
            />
          </div>
        )}

        {/* Not while the phone is changing hands: the next player is looking
            right at this screen to tap the button on it. */}
        {!cpuUp && phase.kind === 'performIntro' && <DeckStrip player={player} label={t('match.yourDeck')} />}
      </footer>

      {/* The handoff and the result sit over a stage that never unmounts, so
          the fighters stay on their marks between turns. */}
      {/* Solo has nobody to hand the phone to, so the opening beat is a card
          announcing who you are up against rather than a handover ritual. */}
      {phase.kind === 'handoff' && !cpuUp && (
        <HandoffScreen
          {...(solo && opponentId
            ? {
                lead: t('handoff.opponent'),
                name: getRival(opponentId).name,
                color: getRival(opponentId).look.color ?? accent,
                emoji: '⚔️',
                note: getRival(opponentId).tagline,
                confirm: 'tap' as const,
                confirmLabel: t('handoff.start'),
              }
            : {
                name: player.name,
                color: accent,
                emoji: character.emoji,
                note: t('common.cardsLeft', { n: player.remaining.length }),
              })}
          onReady={() => dispatch({ type: 'READY', now: now() })}
        />
      )}

      {phase.kind === 'matchEnd' && <ResultScreen winner={phase.winner} reason={phase.reason} />}

      {tutorial !== null && (
        <QteTutorial
          game={tutorial as QteGame}
          onDismiss={() => {
            markTutorialSeen(tutorial)
            dismissTutorial()
          }}
        />
      )}
      {paused && <PauseScreen />}

    </div>
  )
}
