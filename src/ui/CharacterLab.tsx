import { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { MOVES, poseForAction } from '../scene/animations'
import { getBuild } from '../scene/builds'
import { Floor, StageShell } from '../scene/StageShell'
import { FiretoyCharacter } from '../scene/firetoy/FiretoyCharacter'
import {
  COLORWAY_COUNT,
  FIRETOY_PARTS,
  type Gender,
  type WearCategory,
  anatomyOf,
  designCount,
  getPart,
  partAt,
} from '../scene/firetoy/characterParts'
import {
  FEMALE_PRESET_IDS,
  FIRETOY_PRESETS,
  MALE_PRESET_IDS,
  type PresetId,
} from '../scene/firetoy/characterPresets'
import { PLAYER_CHARACTERS, RIVAL_CHARACTER_PRESETS } from '../scene/firetoy/cast'
import { type OutfitChoice, choiceFromOutfit, resolveOutfit } from '../scene/firetoy/outfit'
import type { FighterAction } from '../scene/stageState'
import type { FiretoyLook } from '../engine/types'
import { now } from '../state/store'

/**
 * Dev-only wardrobe range (`?firetoy` in the URL, optionally `?firetoy=male07`).
 *
 * The Firetoy GLBs are one skeleton wearing 310 pieces between them, and there
 * is no way to know what any of them looks like short of switching it on. This
 * is that switch: every category, every design, every colorway, the twenty
 * originals to start from, and the exact node names to copy out when a look is
 * worth keeping.
 *
 * It is not Customize. Nothing here is saved and nothing is priced — the point
 * is to arrive at the six rivals' outfits with the real names in hand.
 */

const CATEGORIES: readonly WearCategory[] = [
  'eyebrows',
  'beard',
  'glasses',
  'mask',
  'hair',
  'hat',
  'headphones',
  'fullbody',
  'torso',
  'pants',
  'shoes',
  'gloves',
]

/**
 * Everything a fighter does in a battle, on a loop: the card gestures, the
 * crouch before one, both sides of a judgement, and the two endings. The rig
 * has to hold all of it, not just the moves — a celebration throws the arms
 * further than any card does, and that is where a retarget goes wrong.
 */
const SPAN_MS = 1600

const ACTIONS: readonly { label: string; at: (t: number) => FighterAction }[] = [
  { label: 'idle', at: () => ({ kind: 'idle' }) },
  ...Object.keys(MOVES).map((animation) => ({
    label: animation,
    at: (t: number): FighterAction => ({
      kind: 'move',
      animation,
      startedAt: loopFrom(t),
      durationMs: SPAN_MS,
    }),
  })),
  {
    label: 'wind up',
    at: (t: number): FighterAction => ({
      kind: 'windUp',
      startedAt: loopFrom(t),
      durationMs: SPAN_MS,
    }),
  },
  ...(['PERFECT', 'GOOD', 'MISS', 'LOST_COMPOSURE'] as const).flatMap((judgement) =>
    (['react', 'watch'] as const).map((kind) => ({
      label: `${kind} ${judgement.toLowerCase()}`,
      at: (t: number): FighterAction => ({
        kind,
        judgement,
        startedAt: loopFrom(t),
        durationMs: SPAN_MS,
      }),
    })),
  ),
  { label: 'won', at: (): FighterAction => ({ kind: 'finale', won: true }) },
  { label: 'lost', at: (): FighterAction => ({ kind: 'finale', won: false }) },
]

/** The start of the loop this instant falls in, so a span repeats forever. */
const loopFrom = (t: number) => Math.floor(t / SPAN_MS) * SPAN_MS

/**
 * The game's own cast, alongside the twenty originals: the six rivals and the
 * four bodies the hot-seat setup hands out. This is where they get changed —
 * open one, move a few pieces, copy the result back into `cast.ts`.
 */
const CAST: readonly { id: string; label: string; look: FiretoyLook }[] = [
  ...Object.entries(RIVAL_CHARACTER_PRESETS).map(([id, look]) => ({
    id,
    label: id.replace(/^the-/, ''),
    look,
  })),
  ...Object.entries(PLAYER_CHARACTERS).map(([id, look]) => ({ id, label: id, look })),
]

const presetsFor = (gender: Gender) =>
  gender === 'male' ? MALE_PRESET_IDS : FEMALE_PRESET_IDS

const genderOf = (id: PresetId): Gender => (id.startsWith('male') ? 'male' : 'female')

/** Where a category currently sits, as design and colorway. */
function coordsOf(gender: Gender, choice: OutfitChoice, category: WearCategory) {
  const node = choice.wear[category]
  if (!node) return { design: 0, colorway: 1, node: null }
  const part = getPart(gender, node)
  return { design: part.design ?? 0, colorway: part.colorway ?? 1, node }
}

function Stepper({
  label,
  value,
  onStep,
}: {
  label: string
  value: string
  onStep: (by: number) => void
}) {
  return (
    <span className="wardrobe__step">
      <button className="wardrobe__arrow" onPointerDown={() => onStep(-1)}>
        ‹
      </button>
      <span className="wardrobe__value">
        {label}
        {value}
      </span>
      <button className="wardrobe__arrow" onPointerDown={() => onStep(1)}>
        ›
      </button>
    </span>
  )
}

/**
 * Frame rate, written straight to the DOM: a React state update every frame
 * would be the only thing on this screen that actually cost anything.
 *
 * Only the frame rate. The renderer's own draw and triangle counters are
 * shared with the post-processing composer, which renders the scene and then
 * three more passes over it, so anything read from them describes the vignette
 * as much as the character.
 */
function PerfHud({ onSample }: { onSample: (fps: number) => void }) {
  const frames = useRef(0)
  const since = useRef(0)

  useFrame(() => {
    frames.current++
    const t = now()
    if (since.current === 0) since.current = t
    if (t - since.current < 500) return
    onSample((frames.current * 1000) / (t - since.current))
    frames.current = 0
    since.current = t
  })

  return null
}

/** Frames the whole body, and steps back when there are two of them. */
function Aim({ distance }: { distance: number }) {
  useFrame(({ camera }) => {
    camera.position.set(0, 0.95, distance)
    camera.lookAt(0, 0.88, 0)
  })
  return null
}

/** Mounts only once the GLB has loaded and been dressed. */
function ReportReady({ onReady }: { onReady: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    onReady()
  })
  return null
}

export function CharacterLab({ initialPreset }: { initialPreset: string }) {
  // `?firetoy=female07` opens an original, `?firetoy=the-gambler` opens a rival.
  const [opening] = useState<{ id: string; look: FiretoyLook }>(() => {
    const cast = CAST.find((c) => c.id === initialPreset)
    if (cast) return { id: cast.id, look: cast.look }
    const id: PresetId = initialPreset in FIRETOY_PRESETS ? (initialPreset as PresetId) : 'male01'
    return { id, look: { gender: genderOf(id), outfit: FIRETOY_PRESETS[id] } }
  })
  const [presetId, setPresetId] = useState<string>(opening.id)
  const [gender, setGender] = useState<Gender>(opening.look.gender)
  const [choice, setChoice] = useState<OutfitChoice>(() =>
    choiceFromOutfit(opening.look.gender, opening.look.outfit),
  )
  const [focus, setFocus] = useState<string | null>(null)
  const [twin, setTwin] = useState(false)
  const [actionIndex, setActionIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [loadMs, setLoadMs] = useState<number | null>(null)

  const started = useRef(now())
  const hud = useRef<HTMLDivElement>(null)

  const outfit = useMemo(() => resolveOutfit(gender, choice), [gender, choice])
  // The second character wears a different preset on purpose: it is the proof
  // that two instances of one cached GLB keep their own wardrobes.
  const twinOutfit = useMemo(
    () => FIRETOY_PRESETS[gender === 'male' ? 'male06' : 'female06'],
    [gender],
  )

  const wear = (category: WearCategory, node: string | null) => {
    setChoice((c) => ({ ...c, wear: { ...c.wear, [category]: node } }))
    setFocus(node)
  }

  const stepDesign = (category: WearCategory, by: number) => {
    const { design, colorway } = coordsOf(gender, choice, category)
    const count = designCount(gender, category)
    // Design 0 is None, so stepping down off the first design turns it off.
    const next = (design + by + count + 1) % (count + 1)
    wear(category, next === 0 ? null : (partAt(gender, category, next, colorway)?.node ?? null))
  }

  const stepColorway = (category: WearCategory, by: number) => {
    const { design, colorway } = coordsOf(gender, choice, category)
    if (design === 0) return
    const next = ((colorway - 1 + by + COLORWAY_COUNT) % COLORWAY_COUNT) + 1
    wear(category, partAt(gender, category, design, next)?.node ?? null)
  }

  const toggleAnatomy = (node: string) => {
    setChoice((c) => ({
      ...c,
      anatomy: c.anatomy.includes(node)
        ? c.anatomy.filter((n) => n !== node)
        : [...c.anatomy, node],
    }))
    setFocus(node)
  }

  /** Open a wardrobe: either one of the twenty originals or one of the cast. */
  const open = (id: string, look: FiretoyLook) => {
    started.current = now()
    if (look.gender !== gender) setLoadMs(null)
    setGender(look.gender)
    setPresetId(id)
    setChoice(choiceFromOutfit(look.gender, look.outfit))
    setFocus(null)
  }

  const loadPreset = (id: PresetId) =>
    open(id, { gender: genderOf(id), outfit: FIRETOY_PRESETS[id] })

  const ready = useCallback(() => setLoadMs(now() - started.current), [])
  const showPerf = useCallback((fps: number) => {
    if (hud.current) hud.current.textContent = `${fps.toFixed(0)} fps`
  }, [])

  const copy = () => {
    const text = [
      `// Firetoy outfit · ${gender} · from ${presetId}`,
      `const outfit = ${JSON.stringify({ gender, anatomy: choice.anatomy, wear: choice.wear }, null, 2)}`,
      ``,
      `const nodes = ${JSON.stringify(outfit, null, 2)}`,
    ].join('\n')
    navigator.clipboard?.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  // Read every frame rather than stored: the pose must never be React state.
  const poseAt = useCallback(() => {
    const t = now()
    return poseForAction(ACTIONS[actionIndex].at(t), getBuild('chad'), t)
  }, [actionIndex])

  const total = FIRETOY_PARTS[gender].length
  const loaded = total * (twin ? 2 : 1)
  const shown = outfit.length + (twin ? twinOutfit.length : 0)

  return (
    <div className="screen screen--lab">
      <header className="lab__head">
        FIRETOY LAB · {gender.toUpperCase()} · {outfit.length}/{total} pieces ·{' '}
        {loadMs === null ? 'loading…' : `${loadMs.toFixed(0)}ms`}
      </header>
      <div className="wardrobe__node">{focus ?? 'tap a category to see its node name'}</div>

      <main className="stage stage--wardrobe">
        <StageShell camera={[0, 0.95, 3.2]} fov={38} fog={[6, 16]}>
          <Floor radius={5} />
          <Aim distance={twin ? 4.6 : 3.2} />
          <Suspense fallback={null}>
            <FiretoyCharacter
              gender={gender}
              outfit={outfit}
              poseAt={poseAt}
              position={[twin ? -0.7 : 0, 0, 0]}
            />
            {twin && (
              <FiretoyCharacter
                gender={gender}
                outfit={twinOutfit}
                poseAt={poseAt}
                position={[0.7, 0, 0]}
              />
            )}
            <ReportReady onReady={ready} />
          </Suspense>
          <PerfHud onSample={showPerf} />
        </StageShell>
      </main>
      <div className="lab__head">
        <span ref={hud}>… fps</span> · {shown} pieces on screen · {loaded - shown} hidden
      </div>

      <div className="wardrobe">
        <div className="wardrobe__row">
          {(['male', 'female'] as const).map((g) => (
            <button
              key={g}
              className="chip"
              data-spent={g !== gender}
              onPointerDown={() => loadPreset(g === 'male' ? 'male01' : 'female01')}
            >
              {g === 'male' ? '♂ MALE' : '♀ FEMALE'}
            </button>
          ))}
          <button className="chip" data-spent={!twin} onPointerDown={() => setTwin((t) => !t)}>
            ×2
          </button>
          <button
            className="chip"
            data-spent={actionIndex === 0}
            onPointerDown={() => setActionIndex((i) => (i + 1) % ACTIONS.length)}
          >
            {ACTIONS[actionIndex].label}
          </button>
          <button className="chip" data-spent={!copied} onPointerDown={copy}>
            {copied ? 'copied ✓' : 'copy'}
          </button>
        </div>

        <div className="wardrobe__row">
          {presetsFor(gender).map((id) => (
            <button
              key={id}
              className="chip"
              data-spent={id !== presetId}
              onPointerDown={() => loadPreset(id)}
            >
              {id.replace(/^(male|female)/, '')}
            </button>
          ))}
        </div>

        <div className="wardrobe__row">
          {CAST.map(({ id, label, look }) => (
            <button
              key={id}
              className="chip"
              data-spent={id !== presetId}
              onPointerDown={() => open(id, look)}
            >
              {label}
            </button>
          ))}
        </div>

        {CATEGORIES.map((category) => {
          const { design, colorway, node } = coordsOf(gender, choice, category)
          const count = designCount(gender, category)
          if (count === 0) return null
          return (
            <div className="wardrobe__cat" key={category} data-on={node !== null}>
              <button className="wardrobe__name" onPointerDown={() => setFocus(node)}>
                {category}
              </button>
              <Stepper
                label=""
                value={design === 0 ? 'none' : `${design}/${count}`}
                onStep={(by) => stepDesign(category, by)}
              />
              <Stepper
                label="c"
                value={design === 0 ? '–' : String(colorway)}
                onStep={(by) => stepColorway(category, by)}
              />
            </div>
          )
        })}

        <div className="wardrobe__row">
          {anatomyOf(gender).map((node) => (
            <button
              key={node}
              className="chip"
              data-spent={!choice.anatomy.includes(node)}
              onPointerDown={() => toggleAnatomy(node)}
            >
              {node.replace(/^Ib_(MALE|FEMALE)_01_/, '')}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
