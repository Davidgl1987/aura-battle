/**
 * The imported animations, one entry each.
 *
 * A card's `animation` key names either one of the pose functions in
 * `animations.ts` or one of these, and `animationFor` is the single place that
 * decides which. Reactions, the idle and the two endings name one too, through
 * `REACTS`, `WATCHES` and `clipForAction` next door. Nothing else in the game
 * has to know the difference: the engine deals a card, the stage works out what
 * that means for a body.
 *
 * Being registered is not the same as being performed. This is everything that
 * has been downloaded and stood up in the lab; `USED_CLIPS` in `animations.ts`
 * is the ones something actually names, and the only ones ever fetched or
 * shipped. Written by `npm run clips` — which is also what measured each one —
 * and then edited by hand, which is why entries keep whatever `loop`,
 * `playbackRate`, window, `hold` and blend somebody gave them.
 *
 * Nine fields. Three of them describe the file and the rest are decisions about
 * it, and the split matters: the desk overwrites `rootMotion` on every run and
 * never touches anything else.
 */
export interface ExternalClip {
  /** Also the card's `animation` key, and how a blend notices a change. */
  readonly id: string
  readonly src: string
  /**
   * Whether it tiles: its last frame meets its first closely enough to run
   * round again without a jolt. Whether it *does* is the action's decision —
   * a short dance repeats to fill a card, an ending holds until somebody taps,
   * and a reaction always plays once. See `clipForAction`.
   */
  readonly loop: boolean
  /** Seconds of clip per second of game time. */
  readonly playbackRate: number
  /**
   * Seconds of the file to play, from its own first frame. Left out, all of it.
   *
   * Three things ask for this and it earns its place on all three. A clip is
   * often longer than the card performing it — `angry` runs nineteen seconds
   * and no card runs four — and playing the useful stretch is better than
   * playing the opening and cutting away. Several clips stand still for a
   * while and then walk, and the stretch before the walk is a whole card. And
   * one file can then serve two purposes without being downloaded twice.
   *
   * It is not a timeline editor: two numbers, no easing, no second window.
   */
  readonly startTime?: number
  readonly endTime?: number
  /**
   * Take the drift out of the hips, so the fighter keeps their mark.
   *
   * Not a pin. Pinning the hips outright would take the weight shift with it —
   * a dance moves its body over a planted foot by 20–30 cm every bar — and the
   * feet would pay for all of it. This drops only what is slower than
   * `DRIFT_SECONDS` in `mocap.ts`, so the sway survives and the journey does
   * not. Vertical motion is never touched: a backflip has to leave the floor.
   *
   * Worth it on exactly one clip so far. Measured, the other eight travellers
   * still skate at 20–107 cm of foot slide per second once their drift is
   * gone, which is why five of them are not used and three are windowed
   * instead.
   */
  readonly hold?: boolean
  /**
   * How long this one takes to fade in and out against the resting animation,
   * overriding `BLEND_IN_MS` / `BLEND_OUT_MS` in `handover.ts`.
   *
   * An escape hatch rather than a knob, and empty on purpose: the defaults were
   * raised once, for everything at once, because every return to idle read as a
   * cut. If a single clip turns out to need its own — one that opens mid-swing,
   * say, and slides into frame — this is where that goes, with the reason next
   * to it.
   */
  readonly blendInMs?: number
  readonly blendOutMs?: number
  /**
   * Whether the clip stays on its mark, *as the game plays it* — through the
   * window above, with the hold applied. Measured, not declared: `npm run
   * clips` reads the hips out of the file and writes this, because Mixamo only
   * offers the In Place box on some animations and the export does not record
   * which way it was left.
   *
   * `travels` earns a clip a place in the lab and nothing else. The stage has
   * no answer for a fighter who walks a metre off their mark and into the one
   * opposite, so a card that names one fails the deck test — the way out is a
   * window that stays put, a `hold`, or a re-export with In Place on, and not
   * a decision that it is probably fine.
   */
  readonly rootMotion: 'inPlace' | 'travels'
}

const CLIPS: Record<string, ExternalClip> = {
  'angry': {
    id: 'angry',
    src: `${import.meta.env.BASE_URL}models/animations/angry.fbx`,
    loop: false,
    playbackRate: 1,
    startTime: 2.3,
    endTime: 5.5,
    rootMotion: 'inPlace',
  },
  'backflip': {
    id: 'backflip',
    src: `${import.meta.env.BASE_URL}models/animations/backflip.fbx`,
    loop: false,
    playbackRate: 1,
    startTime: 0.4,
    endTime: 3.6,
    hold: true,
    rootMotion: 'inPlace',
  },
  'bboy-hip-hop-move': {
    id: 'bboy-hip-hop-move',
    src: `${import.meta.env.BASE_URL}models/animations/bboy-hip-hop-move.fbx`,
    loop: true,
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
    startTime: 5.7,
    endTime: 8.0,
    rootMotion: 'inPlace',
  },
  'defeat': {
    id: 'defeat',
    src: `${import.meta.env.BASE_URL}models/animations/defeat.fbx`,
    loop: true,
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
    startTime: 0.33,
    endTime: 3.93,
    rootMotion: 'inPlace',
  },
  'hip-hop-dancing': {
    id: 'hip-hop-dancing',
    src: `${import.meta.env.BASE_URL}models/animations/hip-hop-dancing.fbx`,
    loop: false,
    playbackRate: 1,
    endTime: 3.05,
    rootMotion: 'inPlace',
  },
  'hokey-pokey': {
    id: 'hokey-pokey',
    src: `${import.meta.env.BASE_URL}models/animations/hokey-pokey.fbx`,
    loop: false,
    playbackRate: 1,
    startTime: 1.5,
    endTime: 3.6,
    rootMotion: 'inPlace',
  },
  'looking': {
    id: 'looking',
    src: `${import.meta.env.BASE_URL}models/animations/looking.fbx`,
    loop: false,
    playbackRate: 1,
    startTime: 0.55,
    endTime: 3.65,
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
    loop: true,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
  'neutral-idle': {
    id: 'neutral-idle',
    src: `${import.meta.env.BASE_URL}models/animations/neutral-idle.fbx`,
    loop: true,
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
    startTime: 0.3,
    endTime: 2.7,
    rootMotion: 'inPlace',
  },
  'swing-dancing': {
    id: 'swing-dancing',
    src: `${import.meta.env.BASE_URL}models/animations/swing-dancing.fbx`,
    loop: false,
    playbackRate: 1,
    startTime: 1.27,
    endTime: 3.7,
    rootMotion: 'inPlace',
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
    startTime: 1.47,
    endTime: 3.9,
    rootMotion: 'inPlace',
  },
  'victory-idle': {
    id: 'victory-idle',
    src: `${import.meta.env.BASE_URL}models/animations/victory-idle.fbx`,
    loop: true,
    playbackRate: 1,
    rootMotion: 'inPlace',
  },
}

/** The clip an animation key names, or undefined if it names a pose. */
export function clipFor(animation: string): ExternalClip | undefined {
  return CLIPS[animation]
}

export const ALL_CLIPS: readonly ExternalClip[] = Object.values(CLIPS)
