/**
 * Handing one body back and forth between its resting animation and whatever
 * it has been asked to perform, without a pop at either end.
 *
 * The resting animation is `neutral-idle`, and it owns the skeleton. Every
 * frame, all sixty-five bones, whether anything else is playing or not — see
 * `clipPlayer.ts`. That is the whole reason this file can be as small as it is:
 * there is no state to hand *back* to, because the base was never given away.
 *
 * It was not always so, and the way it failed is worth writing down. The base
 * used to be the rest pose plus eleven joints of `Pose`, written only on the
 * frame a blend finished. The other fifty-four bones kept whatever the last
 * clip had left them at — fingers curled, feet turned — until something else
 * claimed them, which for a GOOD (a nod, and no clip) was never.
 *
 * So: four phases, and what changes across them is only how much of the
 * performed clip is showing on top of the base.
 *
 *     base ──▶ in ──▶ clip ──▶ out ──▶ base
 *              ▲                │
 *              └────────────────┘   a clip dealt while another is fading out
 *
 * A clip that runs out goes `out` on its own, without being asked, which is
 * what returns a fighter to idle in the middle of a phase that is still up: a
 * card is over long before its resolve screen is, and a reaction is over long
 * before somebody swipes. The one thing that never runs out is a `loop`, which
 * is how the two endings stay on screen.
 *
 * This module is the timing of it — which phase, how far through, and where
 * the clip's playhead is. `clipPlayer.ts` is the half that writes bones. Pure
 * on purpose: every rule below is a line in `handover.test.ts` instead of
 * something to be checked by staring at a fighter.
 */

/**
 * Long enough to read as a movement rather than a cut, short enough that a
 * 2.9-second clip is not mostly blend.
 *
 * Out is longer than in, because the two ends are not the same job. Coming in,
 * the clip is the thing you asked for and it should arrive; going out, the body
 * is settling back to standing and a fast settle reads as a snap. At a shared
 * 120 ms every return to idle looked like a cut, which is what these were
 * raised from.
 *
 * Where they landed is measured rather than felt: `clipPlayer.test.ts` steps
 * each transition at 60 Hz and reports the furthest any one bone turns in a
 * single frame. Taking the body is the tightest of them — the clip arrives at
 * whatever frame it opens on, where a return only ever has to reach standing —
 * so the in blend is sized against that one and the out follows it up.
 *
 * A clip may override either. See `blendInMs` in `clips.ts`; none has needed to.
 */
export const BLEND_IN_MS = 180
export const BLEND_OUT_MS = 280

export type Phase = 'base' | 'in' | 'clip' | 'out'

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
  /**
   * Whether it repeats for as long as its action lasts. Decided by the action
   * rather than by the clip — a short dance tiles to fill a card, an ending
   * holds until somebody taps, and a reaction plays once and gives the body
   * back. See `clipForAction`.
   */
  loop: boolean
  /** The clip's own length, in seconds. */
  duration: number
  blendInMs: number
  blendOutMs: number
}

export interface Handover {
  phase: Phase
  /** When this phase began. */
  since: number
  /** What is playing, so that a different clip — or the same one dealt again — is noticed. */
  key: string | null
}

export const AT_REST: Handover = { phase: 'base', since: 0, key: null }

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
  return ((now - playing.startedAt - playing.blendInMs) / 1000) * playing.rate
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

  // Nobody is asking for a clip. The base already owns the body, so the only
  // thing left is to fade out whatever was still showing over it — and if the
  // clip had already finished on its own, not even that.
  if (!playing) {
    if (state.phase === 'base') {
      return { state: state.key === null ? state : { ...state, key: null }, frame: DONE }
    }
    if (state.phase !== 'out') return begin('out', null, now, 0)
    const k = ease((now - state.since) / BLEND_OUT_MS)
    return k < 1 ? still('out', k, 0) : still('base', 1, 0)
  }

  const clipTime = playhead(playing, now)
  const key = keyOf(playing)

  // A clip this body is not already playing starts a fresh blend from wherever
  // it happens to be — mid-pose, or mid-way out of the clip before it.
  if (key !== state.key) return begin('in', key, now, clipTime)

  switch (state.phase) {
    case 'in': {
      const k = ease((now - state.since) / playing.blendInMs)
      return k < 1 ? still('in', k, clipTime) : still('clip', 1, clipTime)
    }
    case 'clip':
      // A clip that has run out hands the body back without being asked: the
      // action it belongs to usually outlives it by a few hundred milliseconds.
      return !playing.loop && elapsed(playing, now) >= playing.duration
        ? begin('out', key, now, clipTime)
        : still('clip', 1, clipTime)
    case 'out': {
      const k = ease((now - state.since) / playing.blendOutMs)
      return k < 1 ? still('out', k, clipTime) : still('base', 1, clipTime)
    }
    // The clip is over and its action is still up: the fighter is idling, and
    // stays idling until something else is asked of them.
    default:
      return still('base', 1, clipTime)
  }
}

const DONE: Frame = { phase: 'base', k: 1, clipTime: 0, capture: false }
