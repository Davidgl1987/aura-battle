import { describe, expect, it } from 'vitest'
import { AT_REST, BLEND_MS, advance, type Handover, type Playing } from './handover'

const COCKY: Playing = {
  id: 'being-cocky',
  startedAt: 1000,
  rate: 1,
  loop: false,
  duration: 2.9,
}

/** Run the handover forward, returning the last frame and the state with it. */
function run(steps: { at: number; playing?: Playing | null }[], from: Handover = AT_REST) {
  let state = from
  let frame = advance(state, null, 0).frame
  for (const step of steps) {
    const next = advance(state, step.playing ?? null, step.at)
    state = next.state
    frame = next.frame
  }
  return { state, frame }
}

describe('nobody playing a clip', () => {
  it('leaves the body to the pose system', () => {
    const { frame } = run([{ at: 500 }, { at: 516 }])
    expect(frame).toMatchObject({ phase: 'pose', capture: false })
  })
})

describe('taking the body', () => {
  it('captures what is showing on the first frame, and blends from it', () => {
    const { frame } = run([{ at: 1000, playing: COCKY }])
    expect(frame).toMatchObject({ phase: 'in', k: 0, capture: true, clipTime: 0 })
  })

  it('is half way across half way through', () => {
    const { frame } = run([
      { at: 1000, playing: COCKY },
      { at: 1000 + BLEND_MS / 2, playing: COCKY },
    ])
    expect(frame.phase).toBe('in')
    expect(frame.k).toBeCloseTo(0.5)
    expect(frame.capture).toBe(false)
  })

  /** The clip's own clock only starts once the body has arrived at frame one. */
  it('holds the clip on its first frame until the blend is done', () => {
    const { frame } = run([
      { at: 1000, playing: COCKY },
      { at: 1000 + BLEND_MS - 1, playing: COCKY },
    ])
    expect(frame.clipTime).toBe(0)
  })

  it('hands over to the mixer when the blend runs out', () => {
    const { frame } = run([
      { at: 1000, playing: COCKY },
      { at: 1000 + BLEND_MS, playing: COCKY },
    ])
    expect(frame).toMatchObject({ phase: 'clip', k: 1, clipTime: 0, capture: false })
  })
})

describe('playing', () => {
  const at = (ms: number) => run([{ at: 1000, playing: COCKY }, { at: 1000 + BLEND_MS + ms, playing: COCKY }]).frame

  it('runs the playhead on the game clock', () => {
    expect(at(1000).clipTime).toBeCloseTo(1)
    expect(at(2000).clipTime).toBeCloseTo(2)
  })

  it('takes the clip at its own rate', () => {
    const fast = { ...COCKY, rate: 2 }
    const { frame } = run([
      { at: 1000, playing: fast },
      { at: 1000 + BLEND_MS + 1000, playing: fast },
    ])
    expect(frame.clipTime).toBeCloseTo(2)
  })

  /**
   * A clock that is not moving is a paused game, and the frame it holds is the
   * frame it was on. Nothing here reads a wall clock, so that comes for free —
   * this is the test that says so.
   */
  it('holds its frame while the clock does', () => {
    const held = [
      { at: 1000, playing: COCKY },
      { at: 2000, playing: COCKY },
      { at: 2000, playing: COCKY },
    ]
    expect(run(held).frame.clipTime).toBeCloseTo(run(held.slice(0, 2)).frame.clipTime)
  })

  it('never quite reaches the last frame, which would wrap to the first', () => {
    const loop = { ...COCKY, loop: true }
    const { frame } = run([
      { at: 1000, playing: loop },
      { at: 1000 + BLEND_MS + 2900, playing: loop },
    ])
    expect(frame.clipTime).toBeLessThan(loop.duration)
    expect(frame.clipTime).toBeCloseTo(0, 3)
  })

  it('keeps a looping clip going round for as long as the action lasts', () => {
    const loop = { ...COCKY, loop: true }
    const { frame } = run([
      { at: 1000, playing: loop },
      { at: 1000 + BLEND_MS + 3500, playing: loop },
    ])
    expect(frame.phase).toBe('clip')
    expect(frame.clipTime).toBeCloseTo(0.6)
  })
})

describe('giving the body back', () => {
  const played = [
    { at: 1000, playing: COCKY },
    { at: 1000 + BLEND_MS, playing: COCKY },
  ]
  const ended = 1000 + BLEND_MS + 2900

  it('blends out on its own when a clip that does not loop runs out', () => {
    const { frame } = run([...played, { at: ended, playing: COCKY }])
    expect(frame).toMatchObject({ phase: 'out', k: 0, capture: true })
  })

  it('is back on the pose system a blend later', () => {
    const { frame } = run([
      ...played,
      { at: ended, playing: COCKY },
      { at: ended + BLEND_MS, playing: COCKY },
    ])
    expect(frame.phase).toBe('pose')
  })

  /** The card outlives the clip by a few hundred milliseconds. It must not replay. */
  it('does not start again while the same action is still up', () => {
    const { frame } = run([
      ...played,
      { at: ended, playing: COCKY },
      { at: ended + BLEND_MS, playing: COCKY },
      { at: ended + 400, playing: COCKY },
    ])
    expect(frame).toMatchObject({ phase: 'pose', capture: false })
  })

  it('blends out when the action ends first, cutting the clip short', () => {
    const { frame } = run([...played, { at: 2000, playing: COCKY }, { at: 2100 }])
    expect(frame).toMatchObject({ phase: 'out', k: 0, capture: true })
  })
})

describe('a clip arriving over another', () => {
  const played = [
    { at: 1000, playing: COCKY },
    { at: 1500, playing: COCKY },
  ]

  it('starts a fresh blend from wherever the body is', () => {
    const other: Playing = { ...COCKY, id: 'other', startedAt: 1500 }
    const { frame } = run([...played, { at: 1500, playing: other }])
    expect(frame).toMatchObject({ phase: 'in', k: 0, capture: true })
  })

  it('counts the same clip dealt again as a new one', () => {
    const again: Playing = { ...COCKY, startedAt: 4000 }
    const { frame } = run([...played, { at: 4000, playing: again }])
    expect(frame).toMatchObject({ phase: 'in', k: 0, capture: true })
  })

  /**
   * Half a megabyte of FBX can arrive after the card it belongs to has started.
   * The clip is joined where the action says it should be, not restarted, so
   * two fighters on one stage never disagree about the frame.
   */
  it('joins a clip that arrived late in progress', () => {
    const { frame } = run([{ at: 2000, playing: COCKY }])
    expect(frame.phase).toBe('in')
    expect(frame.clipTime).toBeCloseTo(0.88)
  })
})
