import { describe, expect, it } from 'vitest'
import {
  AnimationClip,
  Bone,
  Group,
  type KeyframeTrack,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three'
import { firetoyBone, readMixamo, retargetToFiretoy } from './mocap'

/**
 * The Mixamo skeleton, in the order the exporter writes it. Sixty-five joints,
 * the same sixty-five Firetoy's bodies are rigged with — which is the whole
 * reason the retarget is a rename. Written out here because it is a fixed
 * outside contract: every clip the site exports arrives with these names, and
 * a mapping that stops covering them is the failure this file is here to catch.
 */
const MIXAMO_BONES = [
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Neck',
  'Head',
  'HeadTop_End',
  ...['Left', 'Right'].flatMap((side) => [
    `${side}Shoulder`,
    `${side}Arm`,
    `${side}ForeArm`,
    `${side}Hand`,
    ...['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].flatMap((finger) =>
      [1, 2, 3, 4].map((joint) => `${side}Hand${finger}${joint}`),
    ),
  ]),
  ...['Left', 'Right'].flatMap((side) => [
    `${side}UpLeg`,
    `${side}Leg`,
    `${side}Foot`,
    `${side}ToeBase`,
    `${side}Toe_End`,
  ]),
].map((bone) => `mixamorig${bone}`)

describe('the name rule', () => {
  it('covers the whole Mixamo skeleton, one bone each', () => {
    expect(MIXAMO_BONES).toHaveLength(65)
    const mapped = MIXAMO_BONES.map(firetoyBone)
    expect(mapped.filter((name) => name === null)).toEqual([])
    expect(new Set(mapped).size).toBe(65)
  })

  it('moves the side from the front to the back', () => {
    expect(firetoyBone('mixamorigLeftHandThumb1')).toBe('HandThumb1L')
    expect(firetoyBone('mixamorigRightToe_End')).toBe('Toe_EndR')
    expect(firetoyBone('mixamorigLeftUpLeg')).toBe('UpLegL')
  })

  it('leaves an unsided bone alone', () => {
    expect(firetoyBone('mixamorigHips')).toBe('Hips')
    expect(firetoyBone('mixamorigHeadTop_End')).toBe('HeadTop_End')
  })

  /**
   * The dot is what a loaded scene has already lost, and a track that kept it
   * would not merely miss: three reads `Arm.L.quaternion` as node `Arm`,
   * property `L`.
   */
  it('names bones the way a loaded scene does, not the way the file does', () => {
    for (const name of MIXAMO_BONES.map(firetoyBone)) {
      expect(name).not.toContain('.')
      expect(name).not.toContain(':')
    }
  })

  it('takes the colon, in case the loader has not', () => {
    expect(firetoyBone('mixamorig:LeftForeArm')).toBe('ForeArmL')
  })

  it('does not answer for anything that is not a bone of that rig', () => {
    expect(firetoyBone('Armature')).toBeNull()
    expect(firetoyBone('Hips')).toBeNull()
  })
})

/** One frame is enough for everything the retarget does to a track. */
const HIPS_REST = new Vector3(0, 100, 0)

function sourceClip(...tracks: KeyframeTrack[]) {
  return { clip: new AnimationClip('mixamo.com', 2, tracks), hipsRest: HIPS_REST.clone() }
}

const quaternions = (name: string) =>
  new QuaternionKeyframeTrack(`${name}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0.7, 0, 0.7])

describe('retargeting a clip', () => {
  const target = new Vector3(0, 90, -3)

  it('renames every rotation and keeps the timing', () => {
    const out = retargetToFiretoy(
      sourceClip(quaternions('mixamorigLeftArm'), quaternions('mixamorigSpine1')),
      target,
    )
    expect(out.tracks.map((t) => t.name)).toEqual(['ArmL.quaternion', 'Spine1.quaternion'])
    expect(out.duration).toBe(2)
    expect(out.name).toBe('mixamo.com')
  })

  /**
   * Shared, not copied: nothing here or in the mixer writes to a track, so two
   * characters playing the same clip hold one set of keyframes between them.
   */
  it('hands rotations on by reference', () => {
    const track = quaternions('mixamorigHead')
    const out = retargetToFiretoy(sourceClip(track), target)
    expect(out.tracks[0].values).toBe(track.values)
    expect(out.tracks[0].times).toBe(track.times)
  })

  it('drops what is not a bone of the source rig', () => {
    const out = retargetToFiretoy(sourceClip(quaternions('Armature')), target)
    expect(out.tracks).toEqual([])
  })

  it('scales the hips travel to the legs that carry it', () => {
    const out = retargetToFiretoy(
      sourceClip(
        new VectorKeyframeTrack('mixamorigHips.position', [0, 1], [0, 100, 0, 2, 110, -4]),
      ),
      target,
    )
    // 90/100: the centimetres and the shorter legs are the same one ratio.
    expect(out.tracks[0].name).toBe('Hips.position')
    // Rounded because a keyframe track holds 32-bit floats.
    const landed = [...out.tracks[0].values].map((v) => Number(v.toFixed(4)))
    expect(landed).toEqual([0, 90, -3, 1.8, 99, -6.6])
  })

  /**
   * Only the hips travel. Any other bone's position track is that rig's bone
   * lengths, and writing those into this one stretches it.
   */
  it('drops a position track on any other bone', () => {
    const out = retargetToFiretoy(
      sourceClip(new VectorKeyframeTrack('mixamorigLeftHand.position', [0], [1, 2, 3])),
      target,
    )
    expect(out.tracks).toEqual([])
  })
})

describe('reading a parsed FBX', () => {
  function fakeFbx({ hips = true, clip = true } = {}) {
    const group = new Group()
    if (hips) {
      const bone = new Bone()
      bone.name = 'mixamorigHips'
      bone.position.set(0, 104.27, 0)
      group.add(bone)
    }
    if (clip) group.animations = [new AnimationClip('mixamo.com', 2, [quaternions('mixamorigHead')])]
    return group
  }

  it('takes the clip and the rest the clip is measured against', () => {
    const source = readMixamo(fakeFbx())
    expect(source?.clip.name).toBe('mixamo.com')
    expect(source?.hipsRest.y).toBeCloseTo(104.27)
  })

  it('is null for a file that is not a Mixamo clip', () => {
    expect(readMixamo(fakeFbx({ clip: false }))).toBeNull()
    expect(readMixamo(fakeFbx({ hips: false }))).toBeNull()
  })
})
/**
 * The two things the registry can ask for. Both live on keyframes and nowhere
 * else, so both are checked on tracks built here rather than by staring at a
 * fighter — which is the point of `docs/firetoy.md`'s complaint that neither
 * was measurable before.
 */
describe('playing a stretch of a clip', () => {
  const target = new Vector3(0, 100, 0)

  /** Six seconds at one frame a second, so a window is countable by eye. */
  const seconds = [0, 1, 2, 3, 4, 5]
  const turning = () =>
    new QuaternionKeyframeTrack(
      'mixamorigSpine.quaternion',
      seconds,
      seconds.flatMap((t) => [0, 0, t / 10, 1]),
    )

  it('keeps only the keyframes inside the window', () => {
    const out = retargetToFiretoy(sourceClip(turning()), target, { startTime: 2, endTime: 4 })
    expect([...out.tracks[0].times]).toEqual([0, 1, 2])
    // Re-based, so the window's own first frame is time zero.
    expect(out.duration).toBe(2)
  })

  it('is the whole clip when nothing is asked for', () => {
    const track = turning()
    const out = retargetToFiretoy(sourceClip(track), target, {})
    expect(out.tracks[0].times).toBe(track.times)
    expect(out.duration).toBe(2)
  })

  it('cuts the hips travel to the same window as the rest of the body', () => {
    const out = retargetToFiretoy(
      sourceClip(
        turning(),
        new VectorKeyframeTrack(
          'mixamorigHips.position',
          seconds,
          seconds.flatMap((t) => [0, 100, t]),
        ),
      ),
      target,
      { startTime: 2, endTime: 4 },
    )
    const hips = out.tracks.find((t) => t.name === 'Hips.position')
    expect([...(hips?.times ?? [])]).toEqual([0, 1, 2])
    // The z of frames 2, 3 and 4, laid over this rig's own rest of zero.
    expect([...(hips?.values ?? [])].filter((_, i) => i % 3 === 2)).toEqual([2, 3, 4])
  })

  /**
   * A window that asks for more than there is gets what there is, rather than
   * an empty clip: the numbers are written by a person reading the desk, and
   * one that overshoots by a frame should not blank a fighter.
   */
  it('does not run off either end', () => {
    const out = retargetToFiretoy(sourceClip(turning()), target, { startTime: -3, endTime: 99 })
    expect(out.tracks[0].times).toHaveLength(seconds.length)
  })
})

describe('holding a clip on its mark', () => {
  const target = new Vector3(0, 100, 0)
  /** Ten seconds at 30 fps: long enough to hold a slow walk and a fast sway. */
  const times = Array.from({ length: 300 }, (_, i) => i / 30)

  const hips = (at: (t: number) => number) =>
    new VectorKeyframeTrack('mixamorigHips.position', times, times.flatMap((t) => [at(t), 100, 0]))

  const xs = (clip: AnimationClip) =>
    [...clip.tracks[0].values].filter((_, i) => i % 3 === 0)

  /**
   * Ten metres of walking becomes a third of one. Not zero, and it cannot be:
   * the average at the very first frame only has the half of its window that
   * exists, so it lags the walk by half a window — 0.7 s at a metre a second.
   * That residual is at the two ends and nowhere else, which is why the real
   * backflip measures 27 cm rather than none.
   */
  it('takes a steady walk away and leaves the fighter near where they started', () => {
    // A metre a second, for ten seconds.
    const held = xs(retargetToFiretoy(sourceClip(hips((t) => t * 100)), target, { hold: true }))
    expect(Math.max(...held.map(Math.abs))).toBeLessThan(40)
    // And the middle of it, where the window is whole, is on the mark.
    expect(Math.abs(held[150])).toBeLessThan(1)

    const loose = xs(retargetToFiretoy(sourceClip(hips((t) => t * 100)), target, {}))
    expect(Math.max(...loose)).toBeGreaterThan(900)
  })

  /**
   * The reason this is not a pin. A dance moves its body over a planted foot
   * and the foot pays for none of it, so the sway has to survive or every
   * fighter is on ice.
   */
  it('leaves a sway where it was', () => {
    const sway = (t: number) => Math.sin(t * Math.PI * 2) * 25
    const held = xs(retargetToFiretoy(sourceClip(hips(sway)), target, { hold: true }))
    const swing = Math.max(...held) - Math.min(...held)
    expect(swing).toBeGreaterThan(40)
  })

  it('never touches the height, so a jump still leaves the floor', () => {
    const jump = new VectorKeyframeTrack(
      'mixamorigHips.position',
      times,
      times.flatMap((t) => [t * 100, 100 + Math.max(0, Math.sin(t * Math.PI)) * 50, 0]),
    )
    const out = retargetToFiretoy(sourceClip(jump), target, { hold: true })
    const ys = [...out.tracks[0].values].filter((_, i) => i % 3 === 1)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(50, 0)
  })

  it('leaves the travel alone when nothing asks for the hold', () => {
    const out = retargetToFiretoy(sourceClip(hips((t) => t * 100)), target, {})
    expect(Math.max(...xs(out))).toBeCloseTo(996.7, 0)
  })
})
