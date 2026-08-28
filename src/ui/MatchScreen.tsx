import { Suspense, lazy } from 'react'
import { KIND_LABEL, getCard } from '../engine/cards'
import { getCharacter } from '../engine/characters'
import { outauraTarget } from '../engine/match'
import { now, useGame } from '../state/store'
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

/**
 * three.js is most of the download, and none of it is needed for the title or
 * the deck builder. Split here and it arrives while the players are still
 * picking cards. The setup screen starts that fetch early.
 */
const StageScene = lazy(() =>
  import('../scene/StageScene').then((m) => ({ default: m.StageScene })),
)

export function MatchScreen() {
  const match = useGame((s) => s.match)
  const dispatch = useGame((s) => s.dispatch)
  const paused = useGame((s) => s.paused)
  const setPaused = useGame((s) => s.setPaused)

  const { phase, players, active, lastPlayed, settings } = match
  const player = players[active]
  const rival = players[active === 0 ? 1 : 0]
  const character = getCharacter(player.characterId)

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
            <strong style={{ color: character.color }}>
              {character.emoji} {player.name}
            </strong>{' '}
            · move {move}/{settings.deckSize}
          </div>
          <div className="hud__last">
            {lastPlayed ? (
              <>
                last: {KIND_LABEL[lastPlayed.kind]} {getCard(lastPlayed.cardId).name}
              </>
            ) : (
              'first move of the battle'
            )}
          </div>
          {/* Not during a gesture: the QTE widgets run their own clocks and
              would carry on counting behind the overlay. */}
          <button
            className="hud__pause"
            aria-label="Pause"
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
        {phase.kind === 'choosing' && (
          <>
            <div className="prompt">{player.name}, PICK YOUR MOVE</div>
            {/* What the rival just took, and what it costs to top it. The
                OUTAURA'D bonus is unwinnable if you cannot see the bar. */}
            {beat && (
              <div className="beat">
                {rival.name} took <strong>+{beat.last}</strong> · beat{' '}
                <strong>+{beat.needed}</strong> to OUTAURA them
              </div>
            )}
            <Countdown endsAt={phase.endsAt} totalMs={settings.chooseMs} label="DECIDE" />
            <Hand
              cards={player.remaining}
              deckSize={settings.deckSize}
              lastPlayed={lastPlayed}
              disabled={false}
              onPick={(cardId) => dispatch({ type: 'SELECT_CARD', cardId, now: now() })}
            />
          </>
        )}

        {phase.kind === 'qte' && (
          <QtePanel
            card={getCard(phase.cardId)}
            startedAt={phase.startedAt}
            variation={phase.variation}
            onResult={(judgement) => dispatch({ type: 'QTE_RESULT', judgement, now: now() })}
          />
        )}

        {/* The score sheet is the handoff, and it hands over by being dragged
            rather than tapped: the last taps of a long QTE land after it has
            been graded, and a button here would swallow one and skip the turn. */}
        {settling && (
          <div className="pass" style={{ '--i': phase.result.lines.length + 2 } as React.CSSProperties}>
            <span className="pass__lead">
              {match.pendingEnd ? 'THAT WAS THE LAST MOVE' : 'TURN OVER · PASS THE PHONE TO'}
            </span>
            {!match.pendingEnd && (
              <span className="pass__who" style={{ color: getCharacter(rival.characterId).color }}>
                {getCharacter(rival.characterId).emoji} {rival.name}
              </span>
            )}
            <SlideToPass
              color={match.pendingEnd ? 'var(--gold)' : getCharacter(rival.characterId).color}
              label={match.pendingEnd ? 'SLIDE TO SEE WHO WON' : 'SLIDE WHEN READY'}
              onComplete={() => dispatch({ type: 'READY', now: now() })}
            />
          </div>
        )}

        {/* Not while the phone is changing hands: the next player is looking
            right at this screen to tap the button on it. */}
        {phase.kind === 'performIntro' && <DeckStrip player={player} label="your deck" />}
      </footer>

      {/* The handoff and the result sit over a stage that never unmounts, so
          the fighters stay on their marks between turns. */}
      {phase.kind === 'handoff' && (
        <HandoffScreen
          name={player.name}
          color={character.color}
          emoji={character.emoji}
          note={`${player.remaining.length} card${player.remaining.length === 1 ? '' : 's'} left`}
          onReady={() => dispatch({ type: 'READY', now: now() })}
        />
      )}

      {phase.kind === 'matchEnd' && <ResultScreen winner={phase.winner} reason={phase.reason} />}

      {paused && <PauseScreen />}

    </div>
  )
}
