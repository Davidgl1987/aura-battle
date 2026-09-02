import { Component, Suspense, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Called once the character is either on screen or known not to be coming. */
  onSettled?: () => void
}

/**
 * Waits for a character's body, and carries on without one if it never comes.
 *
 * Two jobs, because a body has two ways of not being on screen yet and both
 * of them used to take the whole stage down with it.
 *
 * **Waiting.** A body is twelve megabytes. The screens above wrap their scene
 * in a `<Suspense>` for the lazy import of the scene module itself, and a body
 * suspending against *that* boundary unmounts the `<Canvas>`: the renderer
 * logs "Context Lost", the floor and the lights go with the fighter, and the
 * stage comes back only once the file has arrived. So the waiting is caught in
 * here, inside the canvas, around the fighter and nothing else.
 *
 * **Failing.** The two GLBs are licensed third-party assets and are not in the
 * repository, so a fresh clone does not have them (see
 * `public/models/characters/README.md`). The loader throws when it cannot find
 * one, and an uncaught throw in a React tree blanks the whole app — which is a
 * black screen and no explanation for someone who has just cloned the game.
 * Caught here, the stage stays up with nobody standing on it.
 */
export class BodyBoundary extends Component<Props, { absent: boolean }> {
  state = { absent: false }

  static getDerivedStateFromError() {
    return { absent: true }
  }

  componentDidCatch(error: Error) {
    // Once, and loudly enough to be findable: this is nearly always a clone
    // without the licensed models rather than a bug in the scene.
    console.warn(
      `[aura] no character body — the stage will be empty. ${error.message}\n` +
        'Licensed Firetoy models go in public/models/characters/ (see the README there).',
    )
    this.props.onSettled?.()
  }

  render() {
    if (this.state.absent) return null
    return <Suspense fallback={null}>{this.props.children}</Suspense>
  }
}
