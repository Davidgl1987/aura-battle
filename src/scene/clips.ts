/**
 * The imported animations, one entry each.
 *
 * A card's `animation` key names either one of the pose functions in
 * `animations.ts` or one of these, and `animationFor` is the single place that
 * decides which. Nothing else in the game has to know the difference: the
 * engine deals a card, the stage works out what that means for a body.
 *
 * Being registered is not the same as being performed. This is everything that
 * has been downloaded and stood up in the lab, and a card names very few of
 * them; `DEALT_CLIPS` is the ones a battle can actually deal, and the only ones
 * ever fetched. Written by `npm run clips` — which is also what measured each
 * one and refused the ones that walk off their mark — and then edited by hand,
 * which is why entries keep whatever `loop` and `playbackRate` somebody gave
 * them.
 *
 * Deliberately four fields and no more. There is no fallback pose, no per-clip
 * blend length and no event track, because nothing has needed one yet —
 * `docs/firetoy.md` records what would ask for them.
 */
export interface ExternalClip {
  /** Also the card's `animation` key, and how a blend notices a change. */
  readonly id: string
  readonly src: string
  /** Whether it repeats for as long as the action lasts, or plays once. */
  readonly loop: boolean
  /** Seconds of clip per second of game time. */
  readonly playbackRate: number
  /**
   * Whether the clip stays on its mark. Measured, not declared: `npm run clips`
   * reads the hips out of the file and writes this, because Mixamo only offers
   * the In Place box on some animations and the export does not record which
   * way it was left.
   *
   * `travels` earns a clip a place in the lab and nothing else. The stage has
   * no answer for a fighter who walks a metre off their mark and into the one
   * opposite, so a card that names one fails the deck test — the way out is to
   * re-export it with In Place on, not to decide it is probably fine.
   */
  readonly rootMotion: 'inPlace' | 'travels'
}

const CLIPS: Record<string, ExternalClip> = {
  'angry': {
    id: 'angry',
    src: `${import.meta.env.BASE_URL}models/animations/angry.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'backflip': {
    id: 'backflip',
    src: `${import.meta.env.BASE_URL}models/animations/backflip.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'travels',
  },
  'bboy-hip-hop-move': {
    id: 'bboy-hip-hop-move',
    src: `${import.meta.env.BASE_URL}models/animations/bboy-hip-hop-move.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'bboy-uprock': {
    id: 'bboy-uprock',
    src: `${import.meta.env.BASE_URL}models/animations/bboy-uprock.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'travels',
  },
  'being-cocky': {
    id: 'being-cocky',
    src: `${import.meta.env.BASE_URL}models/animations/being-cocky.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'breakdance-footwork-to-idle': {
    id: 'breakdance-footwork-to-idle',
    src: `${import.meta.env.BASE_URL}models/animations/breakdance-footwork-to-idle.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'travels',
  },
  'butterfly-twirl': {
    id: 'butterfly-twirl',
    src: `${import.meta.env.BASE_URL}models/animations/butterfly-twirl.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'travels',
  },
  'capoeira': {
    id: 'capoeira',
    src: `${import.meta.env.BASE_URL}models/animations/capoeira.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'travels',
  },
  'dancing-twerk': {
    id: 'dancing-twerk',
    src: `${import.meta.env.BASE_URL}models/animations/dancing-twerk.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'defeat': {
    id: 'defeat',
    src: `${import.meta.env.BASE_URL}models/animations/defeat.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'dismissing-gesture': {
    id: 'dismissing-gesture',
    src: `${import.meta.env.BASE_URL}models/animations/dismissing-gesture.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'gangnam-style': {
    id: 'gangnam-style',
    src: `${import.meta.env.BASE_URL}models/animations/gangnam-style.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'travels',
  },
  'hip-hop-dancing': {
    id: 'hip-hop-dancing',
    src: `${import.meta.env.BASE_URL}models/animations/hip-hop-dancing.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'hokey-pokey': {
    id: 'hokey-pokey',
    src: `${import.meta.env.BASE_URL}models/animations/hokey-pokey.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'looking': {
    id: 'looking',
    src: `${import.meta.env.BASE_URL}models/animations/looking.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'loser': {
    id: 'loser',
    src: `${import.meta.env.BASE_URL}models/animations/loser.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'moonwalk': {
    id: 'moonwalk',
    src: `${import.meta.env.BASE_URL}models/animations/moonwalk.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'neutral-idle': {
    id: 'neutral-idle',
    src: `${import.meta.env.BASE_URL}models/animations/neutral-idle.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'running-forward-flip': {
    id: 'running-forward-flip',
    src: `${import.meta.env.BASE_URL}models/animations/running-forward-flip.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'travels',
  },
  'shaking-head-no': {
    id: 'shaking-head-no',
    src: `${import.meta.env.BASE_URL}models/animations/shaking-head-no.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'silly-dancing': {
    id: 'silly-dancing',
    src: `${import.meta.env.BASE_URL}models/animations/silly-dancing.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'surprised': {
    id: 'surprised',
    src: `${import.meta.env.BASE_URL}models/animations/surprised.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'swing-dancing': {
    id: 'swing-dancing',
    src: `${import.meta.env.BASE_URL}models/animations/swing-dancing.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'travels',
  },
  'sword-and-shield-power-up': {
    id: 'sword-and-shield-power-up',
    src: `${import.meta.env.BASE_URL}models/animations/sword-and-shield-power-up.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'taunt': {
    id: 'taunt',
    src: `${import.meta.env.BASE_URL}models/animations/taunt.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'travels',
  },
  'victory-idle': {
    id: 'victory-idle',
    src: `${import.meta.env.BASE_URL}models/animations/victory-idle.fbx`,
    loop: false,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
}

/** The clip an animation key names, or undefined if it names a pose. */
export function clipFor(animation: string): ExternalClip | undefined {
  return CLIPS[animation]
}

export const ALL_CLIPS: readonly ExternalClip[] = Object.values(CLIPS)
