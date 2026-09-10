import { describe, expect, it } from 'vitest'
import {
  AnimationClip,
  Bone,
  Group,
  Quaternion,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from 'three'
import { makeClipPlayer } from './clipPlayer'
import { BLEND_IN_MS, BLEND_OUT_MS, type Playing } from './handover'
import { makeRig, type Rig } from './rig'
import { NEUTRAL, pose } from '../pose'

/**
 * Who owns which bone, and for how long.
 *
 * This is the file the frozen fighter came out of, so the tests are about
 * ownership rather than about angles. A `Pose` writes eleven joints. A clip
 * writes fifty-two. The body has sixty-five, and every one of them belongs to
 * *something* on every frame — otherwise a finger stays curled, or a pair of
 * arms stays over a head, long after whatever put it there is over.
 */

/** The eleven a pose can reach, plus enough of the rest to have something to lose. */
const POSED = [
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Head',
  'ArmL',
  'ArmR',
  'ForeArmL',
  'ForeArmR',
  'UpLegL',
  'UpLegR',
]
/** Bones no `Pose` has ever heard of. A clip curls these; nothing else does. */
const UNPOSED = ['HandThumb1L', 'HandIndex1L', 'FootL', 'ToeBaseL', 'Neck']

/** A skeleton with the names the loader produces, parented into one chain. */
function body(): { root: Group; rig: Rig } {
  const root = new Group()
  let parent: Group | Bone = root
  for (const name of [...POSED, ...UNPOSED]) {
    const bone = new Bone()
    bone.name = name
    bone.position.set(0, name === 'Hips' ? 100 : 10, 0)
    parent.add(bone)
    parent = bone
  }
  const rig = makeRig(root)
  if (!rig) throw new Error('the fake skeleton is missing a bone the rig wants')
  return { root, rig }
}

/**
 * Something that visibly moves every bone it names, away from rest — and by a
 * different amount when asked, so that two of them are a transition rather than
 * two names for one shape.
 */
function clipOver(names: readonly string[], name = 'moved', angle = 1.2): AnimationClip {
  const turned = new Quaternion().setFromAxisAngle({ x: 0, y: 0, z: 1 }, angle)
  return new AnimationClip(name, 2, [
    ...names.map(
      (bone) =>
        new QuaternionKeyframeTrack(
          `${bone}.quaternion`,
          [0, 2],
          [...turned.toArray(), ...turned.toArray()],
        ),
    ),
    new VectorKeyframeTrack('Hips.position', [0, 2], [0, 100, 0, 0, 100, 0]),
  ])
}

const cue = (over: Partial<Playing> = {}): Playing => ({
  id: 'moved',
  startedAt: 1000,
  rate: 1,
  loop: false,
  duration: 2,
  blendInMs: BLEND_IN_MS,
  blendOutMs: BLEND_OUT_MS,
  ...over,
})

/** How far a bone has been turned from where the file left it. */
const turnedFrom = (rig: Rig, name: string) => {
  const at = rig.rest.find((r) => r.bone.name === name)
  if (!at) throw new Error(`no bone called ${name}`)
  return at.bone.quaternion.angleTo(at.quaternion)
}

/** Every bone a pose cannot reach, at its furthest from rest. */
const strayed = (rig: Rig) => Math.max(...UNPOSED.map((name) => turnedFrom(rig, name)))

describe('who owns the skeleton', () => {
  /**
   * The resting animation is written first, over everything, on every frame.
   * That single rule is what stops any of the rest of this file from leaving a
   * bone behind.
   */
  it('claims every bone from the resting animation, always', () => {
    const { rig } = body()
    const player = makeClipPlayer(rig, null, clipOver([...POSED, ...UNPOSED], 'rest'))
    player.frame(0, null, NEUTRAL)
    expect(strayed(rig)).toBeGreaterThan(1)
  })

  /**
   * The failure this file exists to prevent. A clip curls fifty-two bones; an
   * action that arrives without a clip of its own — a GOOD is a nod, a wind-up
   * is 400 ms — used to write eleven of them and leave the rest exactly where
   * the clip had put them, for as long as that action lasted.
   */
  it('takes the bones back off a clip when the clip is over', () => {
    const { rig } = body()
    const player = makeClipPlayer(rig, clipOver([...POSED, ...UNPOSED]), null)

    player.frame(1000, cue(), NEUTRAL)
    player.frame(1000 + BLEND_IN_MS + 500, cue(), NEUTRAL)
    expect(strayed(rig), 'the clip has the body').toBeGreaterThan(1)

    // Its own length, and then the blend it takes to settle.
    const over = 1000 + BLEND_IN_MS + 2000
    player.frame(over, cue(), NEUTRAL)
    player.frame(over + BLEND_OUT_MS, cue(), NEUTRAL)
    player.frame(over + BLEND_OUT_MS + 16, null, NEUTRAL)
    expect(strayed(rig), 'and gives it back').toBeLessThan(0.02)
  })

  /**
   * The same thing on the path a fighter actually walks: a card, then a
   * reaction the pose system owns because a GOOD has no clip, then the next
   * turn. Nothing is left holding anything.
   */
  it('does not leave a pose standing on the last frame of a clip', () => {
    const { rig } = body()
    const player = makeClipPlayer(rig, clipOver([...POSED, ...UNPOSED]), clipOver([], 'rest'))
    player.frame(1000, cue(), NEUTRAL)
    player.frame(1000 + BLEND_IN_MS + 1000, cue(), NEUTRAL)

    // The card ends and a reaction with no clip of its own takes over.
    const nodding = pose({ headPitch: 0.34 })
    player.frame(4000, null, nodding)
    player.frame(4000 + BLEND_OUT_MS + 16, null, nodding)
    expect(strayed(rig)).toBeLessThan(0.02)
  })

  /**
   * A pose gets the eleven joints it is entitled to while it is being
   * performed — a wind-up, a GOOD — over the top of the base, and through the
   * same blend a clip gets. The player it goes through has no clip of its own,
   * which is what tells it the pose is the performance.
   */
  it('performs a pose when there is no clip to perform', () => {
    const { rig } = body()
    const player = makeClipPlayer(rig, null, clipOver(['Neck'], 'rest'))
    const crouch = pose({ headPitch: 0.5, lean: 0.4 })
    player.frame(1000, cue(), crouch)
    player.frame(1000 + BLEND_IN_MS + 100, cue(), crouch)
    expect(turnedFrom(rig, 'Head')).toBeGreaterThan(0.1)
  })

  /**
   * And gets nothing at all while the fighter is merely standing there. This is
   * the line that makes the resting animation the owner rather than a
   * background layer with the pose system's own idea of standing written over
   * the eleven joints they both have opinions about.
   */
  it('leaves an idle fighter entirely to the resting animation', () => {
    const { rig } = body()
    const player = makeClipPlayer(rig, null, clipOver(['Neck'], 'rest'))
    player.frame(0, null, pose({ headPitch: 0.5, lean: 0.4 }))
    expect(turnedFrom(rig, 'Head')).toBeLessThan(0.001)
    expect(turnedFrom(rig, 'Spine')).toBeLessThan(0.001)
  })

  /** And loses them the moment there is a clip to perform instead. */
  it('ignores the pose while a clip is playing', () => {
    const { rig } = body()
    const player = makeClipPlayer(rig, clipOver(POSED), null)
    const shouting = pose({ headPitch: -1.2, armRaiseL: 2.7 })
    player.frame(1000, cue(), shouting)
    player.frame(1000 + BLEND_IN_MS + 500, cue(), shouting)
    const withPose = turnedFrom(rig, 'Head')

    const clean = body()
    const other = makeClipPlayer(clean.rig, clipOver(POSED), null)
    other.frame(1000, cue(), NEUTRAL)
    other.frame(1000 + BLEND_IN_MS + 500, cue(), NEUTRAL)
    expect(withPose).toBeCloseTo(turnedFrom(clean.rig, 'Head'), 5)
  })

  /**
   * A clip that loops never runs out, so it never hands the body back. Both
   * endings are one, which is the whole of the exception.
   */
  it('keeps a looping clip on the body for good', () => {
    const { rig } = body()
    const held = cue({ loop: true })
    const player = makeClipPlayer(rig, clipOver([...POSED, ...UNPOSED]), clipOver([], 'rest'))
    player.frame(1000, held, NEUTRAL)
    player.frame(1000 + BLEND_IN_MS + 30_000, held, NEUTRAL)
    expect(strayed(rig)).toBeGreaterThan(1)
  })

  /**
   * A held clock is a paused game. Nothing in here reads a wall clock, so two
   * calls at one instant have to draw one frame — including the resting
   * animation underneath, which is the part that is easiest to get wrong.
   */
  it('holds its frame while the clock does', () => {
    const { rig } = body()
    const base = new AnimationClip('rest', 4, [
      new QuaternionKeyframeTrack('NeckL.quaternion', [0, 4], [0, 0, 0, 1, 0, 0, 0.6, 0.8]),
      new QuaternionKeyframeTrack('Neck.quaternion', [0, 4], [0, 0, 0, 1, 0, 0, 0.6, 0.8]),
    ])
    const player = makeClipPlayer(rig, null, base)
    player.frame(2200, null, NEUTRAL)
    const held = turnedFrom(rig, 'Neck')
    player.frame(2200, null, NEUTRAL)
    expect(turnedFrom(rig, 'Neck')).toBeCloseTo(held, 6)
    player.frame(3400, null, NEUTRAL)
    expect(turnedFrom(rig, 'Neck')).not.toBeCloseTo(held, 3)
  })

  /**
   * Two fighters handed the same clock breathe in unison, which reads as a
   * chorus line rather than as two people waiting.
   */
  it('phases one resting loop against the other', () => {
    const base = new AnimationClip('rest', 4, [
      new QuaternionKeyframeTrack('Neck.quaternion', [0, 4], [0, 0, 0, 1, 0, 0, 0.6, 0.8]),
    ])
    const first = body()
    const second = body()
    makeClipPlayer(first.rig, null, base, 0).frame(1000, null, NEUTRAL)
    makeClipPlayer(second.rig, null, base, 1300).frame(1000, null, NEUTRAL)
    expect(turnedFrom(first.rig, 'Neck')).not.toBeCloseTo(turnedFrom(second.rig, 'Neck'), 3)
  })

  /**
   * A clone without the licensed clips has no resting animation either, and the
   * rig's own pose stands in for it — which is what the game did before any of
   * these files existed.
   */
  it('falls back to the rig when there is nothing to rest in', () => {
    const { rig } = body()
    const player = makeClipPlayer(rig, clipOver([...POSED, ...UNPOSED]), null)
    player.frame(1000, cue(), NEUTRAL)
    player.frame(1000 + BLEND_IN_MS + 500, cue(), NEUTRAL)
    player.frame(9000, null, NEUTRAL)
    player.frame(9000 + BLEND_OUT_MS + 16, null, NEUTRAL)
    expect(strayed(rig)).toBeLessThan(0.02)
  })
})

/**
 * No snaps.
 *
 * A transition that is too fast does not look like a fast transition, it looks
 * like a cut — and the way to tell one from the other without a screen is to
 * ask how far any single bone travels between two frames. A blend spreads a
 * gesture's worth of rotation over its whole length; a cut puts all of it in
 * one sixtieth of a second.
 */
describe('getting from one thing to another', () => {
  const FRAME_MS = 1000 / 60
  /**
   * The share of a transition that any one frame may carry.
   *
   * Asked as a fraction rather than as an angle, because how far the body has
   * to travel is the clip's business and not the blend's: two clips a whole arm
   * apart and two clips barely apart are the same job, done over the same
   * milliseconds. Eased over the shorter of the two blends at 60 Hz the peak
   * frame carries about a seventh of the distance; a cut carries all of it.
   */
  const SMOOTH = 0.35

  /**
   * Step the player at 60 Hz. Reports the worst single frame against the whole
   * distance covered, so the answer is a share rather than an angle.
   */
  function jumpiness(
    player: ReturnType<typeof makeClipPlayer>,
    rig: Rig,
    from: number,
    to: number,
    cueAt: (t: number) => Playing | null,
    poseAt: (t: number) => typeof NEUTRAL = () => NEUTRAL,
  ) {
    const was = new Map(rig.rest.map((r) => [r.bone.name, r.bone.quaternion.clone()]))
    const travelled = new Map(rig.rest.map((r) => [r.bone.name, 0]))
    let worst = 0
    for (let t = from; t <= to; t += FRAME_MS) {
      player.frame(t, cueAt(t), poseAt(t))
      for (const { bone } of rig.rest) {
        const before = was.get(bone.name)
        if (before) {
          const step = bone.quaternion.angleTo(before)
          worst = Math.max(worst, step)
          travelled.set(bone.name, (travelled.get(bone.name) ?? 0) + step)
        }
        was.set(bone.name, bone.quaternion.clone())
      }
    }
    const furthest = Math.max(...travelled.values())
    // A transition nothing moved through is not a transition worth grading.
    expect(furthest, 'something has to actually move').toBeGreaterThan(0.2)
    return worst / furthest
  }

  const moving = () => clipOver([...POSED, ...UNPOSED])
  const resting = () => clipOver(['Neck', 'Spine'], 'rest')

  it('eases into a clip rather than cutting to it', () => {
    const { rig } = body()
    const player = makeClipPlayer(rig, moving(), resting())
    player.frame(900, null, NEUTRAL)
    expect(jumpiness(player, rig, 916, 1000 + BLEND_IN_MS + 200, () => cue())).toBeLessThan(SMOOTH)
  })

  /** The one the fighter does most: a card or a reaction ending, on its own. */
  it('eases back to idle when a clip runs out', () => {
    const { rig } = body()
    const player = makeClipPlayer(rig, moving(), resting())
    const over = 1000 + BLEND_IN_MS + 2000
    for (let t = 1000; t < over; t += FRAME_MS) player.frame(t, cue(), NEUTRAL)
    expect(jumpiness(player, rig, over, over + BLEND_OUT_MS + 200, () => cue())).toBeLessThan(SMOOTH)
  })

  /**
   * A card ending straight into the reaction that answers it. The second player
   * is a fresh one because that is what the stage builds when the clip changes,
   * and it has to pick the body up from wherever the first left it.
   */
  it('eases from one clip into the next', () => {
    const { rig } = body()
    const first = makeClipPlayer(rig, moving(), resting())
    for (let t = 1000; t < 2500; t += FRAME_MS) first.frame(t, cue(), NEUTRAL)

    const answering = clipOver([...POSED, ...UNPOSED], 'other', -1.1)
    const second = makeClipPlayer(rig, answering, resting())
    const next = cue({ id: 'other', startedAt: 2500 })
    expect(jumpiness(second, rig, 2500, 2500 + BLEND_IN_MS + 200, () => next)).toBeLessThan(SMOOTH)
  })

  /** And a clip cut short by its phase ending, rather than by running out. */
  it('eases back when a clip is taken away mid-gesture', () => {
    const { rig } = body()
    const player = makeClipPlayer(rig, moving(), resting())
    for (let t = 1000; t < 1800; t += FRAME_MS) player.frame(t, cue(), NEUTRAL)
    expect(jumpiness(player, rig, 1800, 1800 + BLEND_OUT_MS + 200, () => null)).toBeLessThan(SMOOTH)
  })

  /**
   * The wind-up and a GOOD are poses over the resting clip, and they arrive
   * straight off the back of one — so this is the seam that used to leave
   * fifty-four bones where the clip had put them.
   */
  it('eases from a clip into a pose the clip never touched', () => {
    const { rig } = body()
    const player = makeClipPlayer(rig, moving(), resting())
    for (let t = 1000; t < 2500; t += FRAME_MS) player.frame(t, cue(), NEUTRAL)
    const crouch = pose({ lean: 0.22, headPitch: 0.14 })
    const worst = jumpiness(player, rig, 2500, 2500 + BLEND_OUT_MS + 200, () => null, () => crouch)
    expect(worst).toBeLessThan(SMOOTH)
  })
})
