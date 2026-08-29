export type PlayerId = 0 | 1

export type QteKind = 'timing' | 'speed' | 'control'
export type Difficulty = 1 | 2 | 3

export type Judgement = 'PERFECT' | 'GOOD' | 'MISS'
export type Freshness = 'FRESH' | 'NEUTRAL' | 'STALE'

/**
 * Aura is scored as an itemised bill so the resolve screen can show its own
 * arithmetic: every celebration a player sees is a line that actually adds up
 * to the total, rather than a caption guessing at a formula.
 */
export type AuraLineKey =
  | 'miss'
  | 'base'
  | 'perfect'
  | 'fresh'
  | 'hard'
  | 'streak'
  | 'outaurad'
  | 'god'

export interface AuraLine {
  key: AuraLineKey
  label: string
  /** Aura this line put on the total. */
  value: number
  /** Set on multiplier lines, so the UI can print the "x2" as well. */
  multiplier?: number
}

export interface AuraBreakdown {
  lines: AuraLine[]
  /** The play's own worth, before momentum and god aura. See `scorePlay`. */
  impact: number
  total: number
}

/**
 * Which minigame a card runs. Deliberately a second discriminator, separate
 * from `kind`: `kind` is what freshness is measured on and what the card says
 * on its face, so it stays at three. Adding minigames under those three keeps
 * varying your answers worth exactly what it was worth before.
 */
export type QteGame = 'sweep' | 'lanes' | 'mash' | 'order' | 'zone' | 'paths'

/**
 * A cursor sweeps the bar; tap it dead centre, as many times as you can before
 * the animation runs out. Every landed tap makes the next sweep a little
 * quicker.
 *
 * The bar has to come past often enough to reach `goodAt` at all — see
 * `crossings` in `ui/qte/timing.ts`, which a test holds every sweep card to.
 */
export interface TimingParams {
  kind: 'timing'
  game: 'sweep'
  /** Time for the cursor to cross the bar once, before it starts quickening. */
  sweepMs: number
  /** Centres landed to score at all. */
  goodAt: number
  /** Half-width of the PERFECT / GOOD windows, in ms. */
  perfectMs: number
  goodMs: number
}

/**
 * Notes travel down three lanes toward a line; hit each one as it crosses.
 */
export interface LanesParams {
  kind: 'timing'
  game: 'lanes'
  lanes: number
  notes: number
  /** Notes landed to score at all. */
  goodAt: number
  /** How long a note takes to cross the board, entering to hit line. */
  travelMs: number
  /** Gap between one note and the next. */
  gapMs: number
  /** Half-width of the PERFECT / GOOD windows, in ms. */
  perfectMs: number
  goodMs: number
}

/**
 * Alternate between two pads as fast and as long as you can.
 *
 * Open-ended: there is no number of taps the card asks for and then stops. You
 * keep going for the whole animation and every extra alternation is worth
 * more. `goodAt` is what it takes to score at all; being flawless is not a
 * higher count but a clean one — see `settle`.
 */
export interface SpeedParams {
  kind: 'speed'
  game: 'mash'
  /** Alternations landed to score at all. */
  goodAt: number
  /** When true, tapping the same zone twice in a row does not count. */
  alternating: boolean
}

/**
 * Scattered numbers; press them in order, as fast as you can find them. Press
 * the lowest and it goes, and the next of the run appears somewhere else and
 * waits there for its turn.
 *
 * Nothing on this pad is on a clock of its own. A number that changed under
 * you while you were reaching for it was the card playing itself; the only
 * pressure here is the animation running out.
 */
export interface OrderParams {
  kind: 'speed'
  game: 'order'
  /** How many are on the pad at once. */
  visible: number
  /** Numbers pressed in order to score at all. */
  goodAt: number
}

/** Keep the finger inside a drifting zone for as long as possible. */
export interface ControlParams {
  kind: 'control'
  game: 'zone'
  /** Zone radius in normalised screen units (1 = half the short axis). */
  zoneRadius: number
  /** How fast the zone drifts, in normalised units per second. */
  driftSpeed: number
  /** Share of the card duration spent inside the zone needed for each grade. */
  perfectRatio: number
  goodRatio: number
}

/**
 * Two winding lanes scrolling past, a marker in each that only moves sideways,
 * and a thumb steering each one. The driving-licence machine, more or less.
 */
export interface PathsParams {
  kind: 'control'
  game: 'paths'
  /** Half-width of the safe corridor. 1 is half the pad's width. */
  laneWidth: number
  /** How far a lane wanders from the middle of its own half. */
  wander: number
  /** How fast the track scrolls, in track units per second. */
  speed: number
  /** Share of the card spent with BOTH markers in their lane, per grade. */
  perfectRatio: number
  goodRatio: number
}

export type QteParams =
  | TimingParams
  | LanesParams
  | SpeedParams
  | OrderParams
  | ControlParams
  | PathsParams

export interface Card {
  id: string
  name: string
  emoji: string
  kind: QteKind
  difficulty: Difficulty
  /** How long the QTE lasts once it starts. */
  durationMs: number
  /** Aura before any multiplier. */
  baseAura: number
  /** Key of the character animation this card triggers. */
  animation: string
  qte: QteParams
}

/**
 * What a gesture was worth, once it has run its full length. Every QTE returns
 * one of these, so the engine, the CPU and the balance simulation all read a
 * performance the same way.
 */
/**
 * Whether a gesture has a fixed number of chances in it or runs for as long as
 * you can keep it going. It changes how a run is graded, so `engine/qte.ts`
 * asks the card rather than switching on the game a second time.
 */
export type QtePacing = 'counted' | 'open'

export interface QteMetrics {
  /** Opportunities answered at all, cleanly or not. */
  successes: number
  /** Fumbled, ignored, or let run out. All three cost the same. */
  mistakes: number
  /** 0..1 — the share of what was on offer that was taken, after mistakes. */
  accuracy: number
}

export interface QteOutcome {
  judgement: Judgement
  /** Aura the execution itself earned: the card's worth times its accuracy. */
  score: number
  /** False the moment anything is fumbled. PERFECT is a GOOD that never was. */
  perfectEligible: boolean
  metrics: QteMetrics
}

export interface Character {
  id: string
  name: string
  emoji: string
  color: string
  /** Shape note that the F4 procedural model will be built from. */
  build: string
}

export interface MatchSettings {
  /** Cards each player brings to the battle. */
  deckSize: number
  /** Time on the clock to pick a card, in ms. */
  chooseMs: number
}

/**
 * Who answers the QTEs. The reducer never branches on it — every rule applies
 * to both sides — but the shell needs to know whether to wait for a thumb or
 * for the CPU, and whether the phone is changing hands at all.
 */
export type Controller = 'human' | 'cpu'

/** Where an accessory sits on a fighter. One item per slot at a time. */
export type AccessorySlot =
  | 'hair'
  | 'head'
  | 'glasses'
  | 'neck'
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'extras'
  | 'aura'

export interface Accessory {
  id: string
  name: string
  emoji: string
  slot: AccessorySlot
  /** Names the small procedural mesh the stage draws. Not a model file. */
  shape: 'cap' | 'shades' | 'chain' | 'jacket' | 'charm' | 'auraRing'
  color: string
}

/**
 * Cosmetics carried through the match so the stage can dress a fighter. The
 * engine does not read any of it; it rides along with the setup because
 * `characterId` and `name` already do, and splitting presentation across two
 * places would mean the stage looking a fighter up somewhere else mid-battle.
 */
export interface Look {
  /** Overrides the character's own colour, for rivals that share a build. */
  color?: string
  /** Accessory ids, from the catalogue in `accessories.ts`. */
  accessories?: string[]
}

export interface PlayerSetup {
  name: string
  characterId: string
  /** Exactly `settings.deckSize` card ids, in pick order. */
  deck: string[]
  /** Defaults to 'human'. */
  controller?: Controller
  look?: Look
}

export interface PlayedCard {
  cardId: string
  kind: QteKind
}

export interface TurnResult {
  player: PlayerId
  /** null when the player lost composure and never performed. */
  cardId: string | null
  judgement: Judgement | 'LOST_COMPOSURE'
  freshness: Freshness | null
  /** Aura won by this player (negative when they lost some). */
  aura: number
  /**
   * What the play was worth on its own: execution, freshness, difficulty and
   * streak, before momentum, god aura or any outaura bonus.
   *
   * This is the number OUTAURA'D is measured against, and it deliberately
   * excludes the multipliers. Comparing finished totals meant a rival who
   * caught fire could not be out-scored at all — their play was worth double
   * for reasons that had nothing to do with the play.
   */
  impact: number
  /** How the gesture went. Absent when the clock ran out instead. */
  outcome: QteOutcome | null
  /** What made up that number, in the order it should be read out. */
  lines: AuraLine[]
  /** Consecutive PERFECTs after this play, this one included. */
  perfectStreak: number
  momentumBefore: number
  momentumAfter: number
  godAuraBefore: boolean
  godAuraAfter: boolean
}

export interface PlayerState {
  id: PlayerId
  name: string
  characterId: string
  controller: Controller
  look: Look
  /** The cards brought to the battle. Never changes: it is the match record. */
  deck: string[]
  /** Still playable. A card leaves only by being played. */
  remaining: string[]
  /** 0..100 */
  momentum: number
  godAura: boolean
  /** Consecutive PERFECTs. Any other outcome puts it back to zero. */
  perfectStreak: number
  movesPlayed: number
}

export type PhaseKind =
  | 'idle'
  | 'handoff'
  | 'choosing'
  | 'performIntro'
  | 'qte'
  | 'resolve'
  | 'lostComposure'
  | 'matchEnd'

export type Phase =
  | { kind: 'idle' }
  /** Untimed: the phone is changing hands, nothing ticks until READY. */
  | { kind: 'handoff'; player: PlayerId }
  | { kind: 'choosing'; startedAt: number; endsAt: number }
  | { kind: 'performIntro'; cardId: string; endsAt: number }
  /**
   * `variation` is a per-play random number in [0, 1) that the QTE widget uses
   * to shuffle itself, so the same card is not the same puzzle twice. It comes
   * from the match seed, so a battle still replays exactly.
   */
  | { kind: 'qte'; cardId: string; startedAt: number; endsAt: number; variation: number }
  /**
   * The score is on screen and nothing ticks. It doubles as the handoff: the
   * bill stays up until the next player says they are holding the phone, so a
   * big number is never yanked away mid-read.
   */
  | { kind: 'resolve'; result: TurnResult; startedAt: number }
  | { kind: 'lostComposure'; result: TurnResult; startedAt: number }
  | { kind: 'matchEnd'; winner: PlayerId | null; reason: 'mogged' | 'moves' }

export type GameEvent =
  | { type: 'phase'; phase: PhaseKind; player: PlayerId }
  | { type: 'judgement'; player: PlayerId; result: TurnResult }
  | { type: 'godAura'; player: PlayerId; on: boolean }
  | { type: 'mogged'; winner: PlayerId }
  | { type: 'matchEnd'; winner: PlayerId | null; reason: 'mogged' | 'moves' }

export interface MatchState {
  settings: MatchSettings
  phase: Phase
  active: PlayerId
  players: [PlayerState, PlayerState]
  /**
   * Shared aura bar. Positive means player 0 is winning, negative player 1.
   * Clamped to [-100, 100].
   */
  balance: number
  /** Last card played in the match, shared by both players. */
  lastPlayed: PlayedCard | null
  /** Total turns started, both players combined. */
  turnIndex: number
  log: TurnResult[]
  /** Decided while showing the resolve screen, applied when it ends. */
  pendingEnd: { winner: PlayerId | null; reason: 'mogged' | 'moves' } | null
  seed: number
  /** Produced by the last step; the store drains these into the VFX bus. */
  events: GameEvent[]
}

export type Action =
  | {
      type: 'START'
      now: number
      seed?: number
      settings: MatchSettings
      setups: [PlayerSetup, PlayerSetup]
    }
  /** The next player has the phone and tapped to begin. */
  | { type: 'READY'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'SELECT_CARD'; cardId: string; now: number }
  /** The finished gesture, ledger and all. */
  | { type: 'QTE_RESULT'; outcome: QteOutcome; now: number }
  /**
   * Time the game was not running (tab hidden, a long frame hitch). Deadlines
   * move forward by that much so nobody loses a turn they never saw.
   */
  | { type: 'RESUME'; skippedMs: number; now: number }
