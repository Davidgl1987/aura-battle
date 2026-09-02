import { describe, expect, it } from 'vitest'
import BODY_BOUNDARY from './BodyBoundary.tsx?raw'
import SHOWCASE from './Showcase.tsx?raw'
import STAGE_SCENE from './StageScene.tsx?raw'

/**
 * A body is twelve megabytes, so every screen showing one has a component in
 * it that suspends. Where the boundary catching that sits is the difference
 * between a character fading in and the whole stage flickering away.
 *
 * It flickered. The screens wrap their scene in a `<Suspense>` for the lazy
 * import of the scene module itself, and a body suspending against *that*
 * boundary unmounts the `<Canvas>` with it: the renderer logs
 * "Context Lost", the floor and the lights go with the fighter, and the stage
 * comes back only once the file has arrived. Tapping a rival of the other
 * gender did it every time.
 *
 * The fix is `BodyBoundary`, inside the canvas, wrapping the fighter and
 * nothing else. These are the checks that say it is still there — structural,
 * because the failure is a matter of which side of `<StageShell>` a tag falls
 * on and nothing a renderer-less test could otherwise see.
 */
const SCENES = [
  { name: 'Showcase', src: SHOWCASE, fighter: '<Performer' },
  { name: 'StageScene', src: STAGE_SCENE, fighter: '<FiretoyFighter' },
]

const BOUNDARY = '<BodyBoundary'

describe('a body arriving must not take the canvas with it', () => {
  it.each(SCENES)('$name catches every fighter it renders', ({ src, fighter }) => {
    // Not "there is a boundary somewhere" — every fighter has to be inside
    // one. A fighter left outside suspends against whatever boundary the
    // screen above happens to have, which is the bug.
    expect(count(src, fighter)).toBeGreaterThan(0)
    expect(count(boundaries(src).join(''), fighter)).toBe(count(src, fighter))
  })

  it.each(SCENES)('$name uses its boundaries for nothing else', ({ src, fighter }) => {
    const wrapped = boundaries(src)
    expect(wrapped.length).toBeGreaterThan(0)
    for (const region of wrapped) expect(region).toContain(fighter)
  })

  it.each(SCENES)('$name waits through the boundary and not around it', ({ src }) => {
    // A bare `<Suspense>` in a scene file is the old shape coming back: the
    // waiting and the "no body at all" case belong to the same component.
    expect(src).not.toContain('<Suspense')
    expect(src).toContain(BOUNDARY)
  })

  it('the boundary is the one that waits', () => {
    // It is the only place in the scene allowed to hold a Suspense, and it has
    // to catch a throw as well as a wait or a clone without the licensed
    // models blanks the whole app rather than the stage.
    expect(BODY_BOUNDARY).toContain('<Suspense')
    expect(BODY_BOUNDARY).toContain('getDerivedStateFromError')
  })

  it.each(SCENES)('$name never puts the canvas or the stage inside one', ({ src }) => {
    // Floor, lights and camera stay up while a fighter is on the way, and the
    // canvas itself above all: it is the thing that loses its context.
    const wrapped = boundaries(src).join('')
    expect(wrapped).not.toContain('<StageShell')
    expect(wrapped).not.toContain('<Floor')
  })
})

/** Every `<BodyBoundary>…</BodyBoundary>` region, opening tag included. */
function boundaries(src: string): string[] {
  return src.match(/<BodyBoundary[\s\S]*?<\/BodyBoundary>/g) ?? []
}

const count = (src: string, needle: string) => src.split(needle).length - 1
