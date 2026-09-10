import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { readMixamo, retargetToFiretoy } from './firetoy/mocap'
import { USED_CLIPS } from './animations'
import { ALL_CLIPS } from './clips'

/**
 * The registry against the files it describes.
 *
 * Everything else about a clip is checked on tracks built in a test — which is
 * the right way round, because the rules are the point and the files are
 * Adobe's. Two things are not checkable that way. Does `taunt` actually stand
 * still between 1.47 and 3.90 seconds, and does `backflip` actually land where
 * it took off once its drift is gone? Both are claims about one specific file,
 * and `npm run clips` answers them by measuring — but the desk is a script
 * somebody has to remember to run, and this is the same question asked on every
 * `npm test` by whoever has the clips.
 *
 * Skipped on a clone that has not downloaded them, exactly like the game is:
 * see `public/models/animations/README.md`.
 */
const DIR = 'public/models/animations'
const HAVE_CLIPS = ALL_CLIPS.every((clip) => existsSync(join(DIR, `${clip.id}.fbx`)))

/** The male body's hips at rest, in metres. The shorter of the two rigs. */
const HIPS_REST = new Vector3(0, 0.98, 0)

/**
 * The same line the desk draws, in the same units. Dancing on the spot clusters
 * at 20–30 cm of weight shift and walking starts at 66 cm; 45 is the gap
 * between them.
 */
const ON_THE_SPOT = 0.45

function retargeted(id: string) {
  const bytes = readFileSync(join(DIR, `${id}.fbx`))
  const fbx = new FBXLoader().parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    '',
  )
  const source = readMixamo(fbx)
  if (!source) throw new Error(`${id}.fbx is not a Mixamo clip`)
  const entry = ALL_CLIPS.find((clip) => clip.id === id)
  if (!entry) throw new Error(`${id} is not registered`)
  return retargetToFiretoy(source, HIPS_REST, entry)
}

describe.skipIf(!HAVE_CLIPS)('the clips as the game plays them', () => {
  /**
   * The whole point of the window and the hold. Four of these walk a metre or
   * more as exported, and the stage has no answer for a fighter who arrives in
   * the one opposite.
   */
  it('keeps every clip in use on its mark', () => {
    for (const entry of USED_CLIPS) {
      const hips = retargeted(entry.id).tracks.find((t) => t.name === 'Hips.position')
      expect(hips, entry.id).toBeDefined()
      const v = hips!.values
      let far = 0
      for (let i = 0; i < v.length; i += 3) {
        far = Math.max(far, Math.hypot(v[i] - v[0], v[i + 2] - v[2]))
      }
      expect(far, `${entry.id} wanders`).toBeLessThan(ON_THE_SPOT)
    }
  })

  /**
   * A window is two numbers somebody typed while reading the desk, and the way
   * to get them wrong is to name a stretch that is not there: the clip then has
   * one keyframe in it and the fighter holds a single frame for the whole card.
   */
  it('gives every window something to play', () => {
    for (const entry of USED_CLIPS) {
      const clip = retargeted(entry.id)
      expect(clip.tracks, `${entry.id} tracks`).toHaveLength(53)
      expect(clip.duration, `${entry.id} plays for`).toBeGreaterThan(0.9)
      if (entry.endTime !== undefined) {
        // A frame either side, plus a millisecond: the window keeps the
        // keyframes straddling its two bounds, so it covers what was asked for
        // rather than stopping short of it, and 30 fps makes that 33 ms at each
        // end — held, like every keyframe time, as a 32-bit float.
        expect(clip.duration, `${entry.id} window`).toBeLessThanOrEqual(
          entry.endTime - (entry.startTime ?? 0) + 2 / 30 + 0.001,
        )
      }
    }
  })

  /** Feet on the floor. A hips track that sinks is a body buried in the stage. */
  it('never drops a fighter through the floor', () => {
    for (const entry of USED_CLIPS) {
      const hips = retargeted(entry.id).tracks.find((t) => t.name === 'Hips.position')!
      let lowest = Infinity
      for (let i = 1; i < hips.values.length; i += 3) lowest = Math.min(lowest, hips.values[i])
      // Crouches and a backflip's tuck get well under the 0.98 m rest; through
      // the floor is another matter.
      expect(lowest, `${entry.id} lowest hips`).toBeGreaterThan(0.3)
    }
  })
})
