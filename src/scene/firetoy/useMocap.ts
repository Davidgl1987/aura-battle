import { useEffect, useState } from 'react'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { type MixamoClip, readMixamo } from './mocap'

/**
 * Fetching an imported clip: once per file, however many bodies ask for it.
 *
 * Loaded by hand rather than through drei's `useFBX`, because a suspending
 * loader would want a boundary to wait in and an error boundary for the file
 * that is not there — and it is not there on any clone that has not downloaded
 * it, since Mixamo's clips are licensed and gitignored like the bodies are.
 * A missing clip is a null here and a fighter who performs their card with the
 * pose system instead, which is a card that reads as slightly flat rather than
 * a stage that does not come up.
 */
const fetched = new Map<string, Promise<MixamoClip | null>>()

export function loadMocap(src: string): Promise<MixamoClip | null> {
  const already = fetched.get(src)
  if (already) return already

  const arriving = new FBXLoader().loadAsync(src).then(readMixamo, (error: Error) => {
    console.warn(
      `[aura] no clip at ${src} — whoever performs it will hold a pose instead. ${error.message}\n` +
        'Mixamo clips go in public/models/animations/ (see the README there).',
    )
    return null
  })
  fetched.set(src, arriving)
  return arriving
}

/**
 * Fetch a clip before anything needs it — the same trick the screen before a
 * battle already plays on the twelve megabytes of body.
 */
export function preloadMocap(src: string): void {
  void loadMocap(src)
}

/** Null until it arrives, and null for good if it never does. */
export function useMocap(src: string | null): MixamoClip | null {
  const [arrived, setArrived] = useState<{ src: string; clip: MixamoClip | null } | null>(null)

  useEffect(() => {
    if (!src) return
    let live = true
    void loadMocap(src).then((clip) => {
      if (live) setArrived({ src, clip })
    })
    return () => {
      live = false
    }
  }, [src])

  // What arrived is remembered with the file it came from, so that asking for
  // a different clip answers null rather than the last one for a frame.
  return arrived?.src === src ? arrived.clip : null
}
