import { playCrowd, type Reaction } from './crowd'
import { startMusic } from './music'
import { SOUNDS, type SoundName } from './sounds'

/**
 * A tiny synthesiser. Browsers refuse to make noise until the player has
 * touched the screen, so nothing is built until `unlock` runs on their first
 * tap — before that every `play` is a no-op rather than an error.
 */
let ctx: AudioContext | null = null
let master: GainNode | null = null
/** The loop's own fader, so music and effects are two switches, not one. */
let musicBus: GainNode | null = null
let noise: AudioBuffer | null = null
let sfxMuted = false
let musicMuted = false

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }
/** Safari 16.4+ only, and not in the DOM types yet. */
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

const MASTER_GAIN = 0.9

function noiseBuffer(context: AudioContext): AudioBuffer {
  if (noise) return noise
  const frames = context.sampleRate * 0.6
  const buffer = context.createBuffer(1, frames, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  noise = buffer
  return buffer
}

/**
 * Stops when the phone does. `audioSession.type = 'playback'` is what lets the
 * game be heard with the ringer switch off, but it also tells iOS this audio is
 * worth keeping alive in the background — true of a podcast, and not of a game
 * the player has just switched away from.
 */
function followVisibility(context: AudioContext): void {
  const sync = () => {
    if (document.visibilityState === 'hidden') void context.suspend()
    else void context.resume()
  }
  document.addEventListener('visibilitychange', sync)
  // Safari has never been dependable about visibilitychange on the way out.
  // `pagehide` is the one it always sends.
  window.addEventListener('pagehide', () => void context.suspend())
  window.addEventListener('pageshow', () => void context.resume())
}

export function unlock(): void {
  if (ctx) {
    void ctx.resume()
    return
  }
  const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
  if (!Ctor) return

  // Without this an iPhone plays a web game in total silence whenever the
  // ringer switch is flipped, which is most of the time.
  const session = (navigator as AudioSessionNavigator).audioSession
  if (session) session.type = 'playback'

  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = MASTER_GAIN

  // A limiter on the way out. At the climax of a battle the loop, two crowd
  // reactions and an effect can all peak together, and hand-balancing every
  // combination of those is a losing game — this catches the sum instead.
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.knee.value = 6
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.15

  master.connect(limiter).connect(ctx.destination)

  // The loop gets its own fader under the master. Without it, muting effects
  // and muting music are the same switch, and the settings screen offers two.
  musicBus = ctx.createGain()
  musicBus.gain.value = musicMuted ? 0 : 1
  musicBus.connect(master)

  followVisibility(ctx)
  void ctx.resume()

  // iOS only really opens the tap once something has actually been played
  // inside the gesture, so it gets a sample of silence to chew on.
  const kick = ctx.createBufferSource()
  kick.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
  kick.connect(master)
  kick.start(0)

  // Under the music fader, itself under the master gain: the global mute still
  // covers everything, and the music switch covers only the loop.
  startMusic(ctx, musicBus)
}

/** Judgements, hits and the crowd. The loop keeps playing. */
export function setSfxMuted(value: boolean): void {
  sfxMuted = value
}

/** The loop. Effects keep firing. */
export function setMusicMuted(value: boolean): void {
  musicMuted = value
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, 0.08)
}

/** The room reacting. Same gate as everything else: silent until unlocked. */
export function crowd(reaction: Reaction): void {
  if (sfxMuted || !ctx || !master || ctx.state !== 'running') return
  playCrowd(ctx, master, reaction)
}

export function play(name: SoundName): void {
  if (sfxMuted || !ctx || !master || ctx.state !== 'running') return

  const sound = SOUNDS[name]
  const now = ctx.currentTime

  for (const t of sound.tones) {
    const start = now + t.startMs / 1000
    const end = start + t.durationMs / 1000
    const osc = ctx.createOscillator()
    osc.type = t.type
    osc.frequency.setValueAtTime(t.freq, start)
    if (t.slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, t.slideTo), end)
    }

    // A hard start would click; ramp in over a few milliseconds instead.
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.linearRampToValueAtTime(t.gain, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)

    osc.connect(gain).connect(master)
    osc.start(start)
    osc.stop(end + 0.02)
  }

  for (const n of sound.noise ?? []) {
    const start = now + n.startMs / 1000
    const end = start + n.durationMs / 1000
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = n.cutoff

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(n.gain, start)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)

    source.connect(filter).connect(gain).connect(master)
    source.start(start)
    source.stop(end + 0.02)
  }
}

// Dev handle: the synth has no screen of its own, so tuning it means poking at
// it from the console. Same shape as `window.__game`, and guarded the same way
// so the module still imports in plain node.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __audio: unknown }).__audio = {
    state: () => ({ context: ctx?.state ?? 'closed', sfxMuted, musicMuted }),
    unlock,
    play,
    crowd,
  }
}
