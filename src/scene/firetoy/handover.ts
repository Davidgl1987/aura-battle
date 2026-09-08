/**
 * Handing one body back and forth between the pose system and an imported
 * clip, without a pop at either end.
 *
 * A `Pose` writes eleven joints over the rest pose; a clip writes fifty-two,
 * fingers included. Switching between them on the frame a card starts is a
 * visible jump — the arms are in one place and then another, and the hands are
 * the worst of it, because a clip curls the fingers and a pose has never heard
 * of them. So neither side ever takes the body outright: whatever is showing
 * is captured, and the new owner is faded in over `BLEND_MS`.
 *
 * That is four phases and nothing more:
 *
 *     pose ──▶ in ──▶ clip ──▶ out ──▶ pose
 *              ▲                │
 *              └────────────────┘   a clip dealt while another is fading out
 *
 * This module is the timing of it — which phase, how far through, and where
 * the clip's playhead is. `clipPlayer.ts` is the half that writes bones. Pure
 * on purpose: every rule below is a line in `handover.test.ts` instead of
 * something to be checked by staring at a fighter.
 */

/**
 * Long enough to read as a movement rather than a cut, short enough that a
 * 2.9-second clip is not mostly blend. Measured against the game's own moves,
 * which take about this long to rise out of standing.
 */
export const BLEND_MS = 120

export type Phase = 'pose' | 'in' | 'clip' | 'out'

/** A clip that should be playing, and the game-clock instant it started. */
export interface Playing {
  /** The clip's registry id. */
  id: string
  /**
   * When the action carrying it began — not when this body noticed. A clip
   * that arrives late is therefore joined in progress rather than restarted,
   * which is what keeps two fighters and a reload showing the same frame.
   */
  startedAt: number
  /** Seconds of clip per second of game time. */
  rate: number
  loop: boolean
  /** The clip's own length, in seconds. */
  duration: number
}

export interface Handover {
  phase: Phase
  /** When this phase began. */
  since: number
  /** What is playing, so that a different clip — or the same one dealt again — is noticed. */
  key: string | null
}

export const AT_REST: Handover = { phase: 'pose', since: 0, key: null }

export interface Frame {
  phase: Phase
  /** 0 at the start of a blend, 1 at its end, and 1 when there is no blend. */
  k: number
  /** Seconds into the clip. Only meaningful in `in` and `clip`. */
  clipTime: number
  /** The frame a blend begins: whatever is showing has to be captured first. */
  capture: boolean
}

/** Ease in and out, so a blend has no corner at either end. */
const ease = (t: number): number => {
  const p = Math.min(1, Math.max(0, t))
  return p * p * (3 - 2 * p)
}

const keyOf = (playing: Playing) => `${playing.id}@${playing.startedAt}`

/**
 * Where the playhead is, in seconds, before it is fitted to the clip's length.
 * Negative for the whole blend in: the clip's own clock starts once the body
 * has arrived at its first frame.
 */
function elapsed(playing: Playing, now: number): number {
  return ((now - playing.startedAt - BLEND_MS) / 1000) * playing.rate
}

/**
 * A hair short of the end, because `AnimationMixer.setTime(duration)` on a
 * repeating action wraps around to the first frame — which would show the
 * fighter snapping back to their opening stance for the one frame before the
 * blend out, the exact pop this module exists to prevent.
 */
const LAST_FRAME = 1e-3

function playhead(playing: Playing, now: number): number {
  const at = elapsed(playing, now)
  const { duration, loop } = playing
  if (loop) return ((at % duration) + duration) % duration
  return Math.min(Math.max(at, 0), Math.max(0, duration - LAST_FRAME))
}

const begin = (phase: Phase, key: string | null, now: number, clipTime: number) => ({
  state: { phase, since: now, key },
  frame: { phase, k: 0, clipTime, capture: true },
})

/** One frame of the handover: what to write, and how much of it. */
export function advance(
  state: Handover,
  playing: Playing | null,
  now: number,
): { state: Handover; frame: Frame } {
  const still = (phase: Phase, k: number, clipTime: number) => ({
    state: phase === state.phase ? state : { ...state, phase, since: now },
    frame: { phase, k, clipTime, capture: false },
  })

  // Nobody is asking for a clip: give the body back, once.
  if (!playing) {
    if (state.phase === 'pose') {
      return { state: state.key === null ? state : { ...state, key: null }, frame: DONE }
    }
    if (state.phase !== 'out') return begin('out', null, now, 0)
    const k = ease((now - state.since) / BLEND_MS)
    return k < 1 ? still('out', k, 0) : still('pose', 1, 0)
  }

  const clipTime = playhead(playing, now)
  const key = keyOf(playing)

  // A clip this body is not already playing starts a fresh blend from wherever
  // it happens to be — mid-pose, or mid-way out of the clip before it.
  if (key !== state.key) return begin('in', key, now, clipTime)

  switch (state.phase) {
    case 'in': {
      const k = ease((now - state.since) / BLEND_MS)
      return k < 1 ? still('in', k, clipTime) : still('clip', 1, clipTime)
    }
    case 'clip':
      // A clip that has run out hands the body back without being asked: the
      // action it belongs to usually outlives it by a few hundred milliseconds.
      return !playing.loop && elapsed(playing, now) >= playing.duration
        ? begin('out', key, now, clipTime)
        : still('clip', 1, clipTime)
    case 'out': {
      const k = ease((now - state.since) / BLEND_MS)
      return k < 1 ? still('out', k, clipTime) : still('pose', 1, clipTime)
    }
    // The clip is over and its action is still up: the pose system has it.
    default:
      return still('pose', 1, clipTime)
  }
}

const DONE: Frame = { phase: 'pose', k: 1, clipTime: 0, capture: false }
