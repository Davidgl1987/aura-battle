#!/usr/bin/env node
/**
 * The clips desk: what has arrived in `public/models/animations`, what the
 * game knows about, and how the first becomes the second.
 *
 *     npm run clips                 look at what is there, and register it
 *     npm run clips -- --upload     and push the registered files to the assets repo
 *     npm run clips -- --dry-run    say what either would do, and change nothing
 *
 * Three jobs, in order.
 *
 * **Rename.** Mixamo names an export after whatever the button said, so files
 * arrive as `Being Cocky.fbx` or `Hip Hop Dancing (1).fbx`. The file name is
 * the id the whole game refers to a clip by — `src/scene/clips.ts`, a card's
 * `animation`, the lab's chip — so it is settled here, once, in kebab-case,
 * before anything has learnt to say it the other way.
 *
 * **Measure.** A clip is three seconds of somebody else's decisions, and two of
 * them matter here. Does it stay on its mark, and do its ends meet — the whole
 * of the `loop` question. Both are in the file and neither is on the download
 * page, so they are read out of the keyframes rather than taken on trust.
 * Everything present is measured on every run, not only what is new: a clip
 * re-exported with In Place on is a different file that deserves a different
 * answer, and this is what notices.
 *
 * Measured through the entry, though, not around it. A registered clip may name
 * a window of itself to play and may ask for its drift to be taken out, and it
 * is the stretch the game actually performs that has to stay on its mark — so
 * `taunt` gestures for two seconds, then walks, and is `inPlace` because the
 * two seconds are what a card was given.
 *
 * **Register and ship.** Everything in the folder gets an entry, because a clip
 * has to be registered before the lab can show it and the lab is where these
 * are judged. What the measurement decides is `rootMotion` — a clip that walks
 * is written down as one, which keeps it out of a card until somebody windows,
 * holds or re-exports it — and never `loop`, the window, or which card performs
 * what, which are decisions for a person in front of the lab and not for a
 * script that has never seen the animation. Uploading puts the files where the
 * Pages build looks for them, since they are Adobe's to license and ours only
 * to borrow, and so they never enter this repository — and it sends only the
 * clips something actually names, because everything in `public/` is published
 * and a clip nobody performs is 600 kB sitting at a public URL.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Quaternion } from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const CLIPS_DIR = join(ROOT, 'public/models/animations')
const REGISTRY = join(ROOT, 'src/scene/clips.ts')
const SOURCE = join(ROOT, 'src')

/** Where the licensed files live, and the branch the Pages build reads. */
const ASSETS_REPO = 'https://github.com/Davidgl1987/private-game-assets.git'
const ASSETS_PATH = 'aura-battle/mixamo/runtime'
const ASSETS_CLONE = join(ROOT, '.assets/private-game-assets')

/**
 * How far the hips may wander and still count as standing on their mark.
 *
 * Measured in hip heights, because a Mixamo file's centimetres are not the
 * game's metres and this ratio is what survives the retarget — and a hip height
 * is near enough a metre on both bodies (0.98 m male, 1.07 m female), so the
 * numbers below double as centimetres.
 *
 * Where the line sits is the sixteen clips themselves. Dancing on the spot
 * clusters at 20–30 cm of weight shift, walking starts at 66 cm, and there is
 * nothing at all in between: 0.45 is the middle of that gap rather than a round
 * number somebody liked.
 */
const ON_THE_SPOT = 0.45

/** A hip height, roughly, for saying a wander out loud. */
const HIP_CM = 100

/**
 * Above this, the last frame is far enough from the first for a loop to show.
 *
 * Only ever asked of a clip that loops. A window's two ends have no reason to
 * meet — `taunt` starts mid-gesture at 1.47 s and stops at 3.90 s — and saying
 * so about the twenty entries that play once was twenty lines of noise around
 * the one that mattered.
 */
const JOLT_DEG = 12

/**
 * What the download page is meant to be set to. Nothing breaks at another rate
 * — playback reads the keyframes against the clock, not frame by frame — but a
 * clip that came down at 66 fps is twice the file for the same motion, and it
 * means somebody's export settings moved without noticing.
 */
const EXPORTED_FPS = 30

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const upload = args.has('--upload')

const say = (line = '') => console.log(line)
const problems = []
const complain = (line) => {
  problems.push(line)
  say(`  ⚠ ${line}`)
}

/** `Being Cocky (1).fbx` → `being-cocky`. */
function kebab(file) {
  return basename(file, '.fbx')
    .replace(/\s*\(\d+\)\s*$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * How long a wander has to last before it counts as going somewhere. The same
 * number as `DRIFT_SECONDS` in `mocap.ts`, for the same reason, and it has to
 * stay the same number: this measures what that produces.
 */
const DRIFT_SECONDS = 1.4

/** A track's slow half, so it can be taken off. Mirrors `held` in `mocap.ts`. */
function deDrift(times, values, axis) {
  const out = new Float32Array(times.length)
  const half = DRIFT_SECONDS / 2
  let from = 0
  let to = 0
  let sum = 0
  for (let i = 0; i < times.length; i++) {
    while (to < times.length && times[to] <= times[i] + half) sum += values[to++ * 3 + axis]
    while (times[from] < times[i] - half) sum -= values[from++ * 3 + axis]
    out[i] = values[i * 3 + axis] - sum / (to - from)
  }
  return out
}

/**
 * Everything the file itself can answer, asked of the stretch the game actually
 * plays. It does not go through `mocap.ts`, which is TypeScript and would want
 * a build step to run from here: the only thing borrowed is the name of the
 * joint the translation lives on and the arithmetic above, and both are a few
 * lines rather than two imports away.
 *
 * `how` is the entry the registry already holds — its window and its hold — so
 * a clip that walks for two seconds and then stands still is measured on the
 * standing still, which is the part a card was given. Nothing else here reads
 * the registry: the numbers belong to the file, and only the question does.
 */
function measure(path, how = {}) {
  const bytes = readFileSync(path)
  const fbx = new FBXLoader().parse(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  )
  const clip = fbx.animations[0]
  const hips = fbx.getObjectByName('mixamorigHips') ?? fbx.getObjectByName('mixamorig:Hips')
  if (!clip || !hips) return null

  const turns = clip.tracks.filter((t) => t.name.endsWith('.quaternion'))
  const travelTrack = clip.tracks.find((t) => t.name.endsWith('.position') && /Hips/.test(t.name))

  // The keyframes the window keeps, as a half-open range into each track.
  const cut = (track) => {
    let from = 0
    let to = track.times.length - 1
    if (how.startTime !== undefined) while (from < to && track.times[from + 1] <= how.startTime) from++
    if (how.endTime !== undefined) while (to > from && track.times[to - 1] >= how.endTime) to--
    return { from, to }
  }

  // How far the hips get from where they started, at their furthest, across the
  // floor. Not the drift from first frame to last: a clip that walks out and
  // back is still a clip that leaves its mark.
  let travel = 0
  if (travelTrack && hips.position.y) {
    const { from, to } = cut(travelTrack)
    const times = travelTrack.times.slice(from, to + 1)
    const v = travelTrack.values.slice(from * 3, (to + 1) * 3)
    const xs = how.hold ? deDrift(times, v, 0) : null
    const zs = how.hold ? deDrift(times, v, 2) : null
    const at = (i) => [xs ? xs[i] : v[i * 3], zs ? zs[i] : v[i * 3 + 2]]
    const [x0, z0] = at(0)
    for (let i = 0; i < times.length; i++) {
      const [x, z] = at(i)
      travel = Math.max(travel, Math.hypot(x - x0, z - z0))
    }
    travel /= Math.abs(hips.position.y)
  }

  // The worst any one bone has to turn to get from the last frame of the window
  // back to its first — what a loop would show as a jolt, and what a clip that
  // plays once never sees.
  const a = new Quaternion()
  const b = new Quaternion()
  let seam = 0
  for (const track of turns) {
    const { from, to } = cut(track)
    a.fromArray(track.values, from * 4).normalize()
    b.fromArray(track.values, to * 4).normalize()
    seam = Math.max(seam, a.angleTo(b))
  }

  const { from, to } = turns[0] ? cut(turns[0]) : { from: 0, to: 0 }
  const played =
    turns[0] && to > from ? turns[0].times[to] - turns[0].times[from] : clip.duration
  const times = turns[0]?.times.length ?? 0
  return {
    duration: clip.duration,
    played,
    fps: clip.duration > 0 ? Math.round((times - 1) / clip.duration) : 0,
    tracks: clip.tracks.length,
    travel,
    seam: (seam * 180) / Math.PI,
    kb: Math.round(statSync(path).size / 1024),
  }
}

/** Every entry in the registry, as the text it is, keyed by id. */
function entriesOf(source) {
  const block = /(const CLIPS: Record<string, ExternalClip> = \{\n)([\s\S]*?)(\n\}\n)/.exec(source)
  if (!block) throw new Error(`Cannot find the CLIPS object in ${REGISTRY}`)
  const entries = new Map()
  for (const entry of block[2].matchAll(/^ {2}'([a-z0-9-]+)': \{\n(?: {4,}.*\n)+? {2}\},$/gm)) {
    entries.set(entry[1], entry[0])
  }
  return { block, entries }
}

/**
 * The decisions the measurement has to know about, read back out of the entry
 * a person wrote. Everything else in there is the game's business.
 */
function howPlayed(entry = '') {
  const number = (field) => {
    const found = new RegExp(`${field}: (-?[0-9.]+),`).exec(entry)
    return found ? Number(found[1]) : undefined
  }
  return {
    startTime: number('startTime'),
    endTime: number('endTime'),
    hold: /hold: true,/.test(entry),
    loop: /loop: true,/.test(entry),
  }
}

/**
 * The registry, rewritten. Entries already in the file are carried over as the
 * text they are, so a `loop` or a window somebody wrote by hand survives the
 * next run — bar `rootMotion`, which belongs to the file rather than to
 * anybody's opinion and is corrected in place when the two disagree.
 */
function register(spots) {
  const source = readFileSync(REGISTRY, 'utf8')
  const { block, entries } = entriesOf(source)

  const corrected = []
  for (const [id, spot] of spots) {
    const was = entries.get(id)
    if (was) {
      const now = was.replace(/rootMotion: '(?:inPlace|travels)'/, `rootMotion: '${spot}'`)
      if (now !== was) corrected.push(`${id} → ${spot}`)
      entries.set(id, now)
      continue
    }
    entries.set(
      id,
      [
        `  '${id}': {`,
        `    id: '${id}',`,
        '    src: `${import.meta.env.BASE_URL}' + `models/animations/${id}.fbx\`,`,
        '    loop: false,',
        '    playbackRate: 1,',
        `    rootMotion: '${spot}',`,
        '  },',
      ].join('\n'),
    )
  }

  const sorted = [...entries.keys()].sort()
  const rebuilt = block[1] + sorted.map((id) => entries.get(id)).join('\n') + block[3]
  const next = source.slice(0, block.index) + rebuilt + source.slice(block.index + block[0].length)
  if (!dryRun) writeFileSync(REGISTRY, next)
  return { all: sorted, corrected }
}

/**
 * The registered clips something actually names, which is not all of them.
 *
 * Asked of the source rather than of a list kept here, because a list kept here
 * is a list that goes stale the first time a card is repointed. An id is a
 * kebab-case string and every consumer quotes it — `animation: 'moonwalk'`, a
 * beat in `animations.ts` — so the question is whether the quoted id appears
 * anywhere under `src/` outside the registry that defines it.
 */
function usedIds(ids) {
  const seen = new Set()
  const walk = (dir) => {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, item.name)
      if (item.isDirectory()) {
        walk(path)
        continue
      }
      if (path === REGISTRY || !/\.tsx?$/.test(item.name) || /\.test\.tsx?$/.test(item.name)) continue
      const text = readFileSync(path, 'utf8')
      for (const id of ids) if (text.includes(`'${id}'`)) seen.add(id)
    }
  }
  walk(SOURCE)
  return [...seen].sort()
}

/** The named files, into the assets repository, as one commit. */
function ship(ids) {
  const into = join(ASSETS_CLONE, ASSETS_PATH)

  // Worked out before anything is cloned, so that a dry run says what it would
  // send without touching the network.
  const sending = ids.filter((id) => {
    const from = join(CLIPS_DIR, `${id}.fbx`)
    if (!existsSync(from)) return false
    const to = join(into, `${id}.fbx`)
    return !existsSync(to) || readFileSync(from).compare(readFileSync(to)) !== 0
  })

  if (sending.length === 0) return say('  the assets repository already has every clip in use')
  const mb = sending.reduce((n, id) => n + statSync(join(CLIPS_DIR, `${id}.fbx`)).size, 0) / 1024 ** 2
  say(`  ${sending.length} to send, ${mb.toFixed(1)} MB: ${sending.join(', ')}`)
  if (dryRun) return say('  (dry run: nothing cloned, copied, committed or pushed)')

  if (!existsSync(join(ASSETS_CLONE, '.git'))) {
    say(`  cloning ${ASSETS_REPO} into .assets/ …`)
    mkdirSync(join(ROOT, '.assets'), { recursive: true })
    // Blobless and sparse: the history is wanted so that a push has something
    // to stand on, the twenty-three megabytes of character model are not.
    execFileSync('git', ['clone', '--quiet', '--filter=blob:none', '--sparse', ASSETS_REPO, ASSETS_CLONE], { stdio: 'inherit' })
    execFileSync('git', ['-C', ASSETS_CLONE, 'sparse-checkout', 'set', ASSETS_PATH], { stdio: 'inherit' })
    // The identity this repository commits under, not the machine's default,
    // which belongs to somebody's day job.
    for (const key of ['user.name', 'user.email']) {
      const value = execFileSync('git', ['-C', ROOT, 'config', '--get', key]).toString().trim()
      execFileSync('git', ['-C', ASSETS_CLONE, 'config', key, value])
    }
  } else {
    execFileSync('git', ['-C', ASSETS_CLONE, 'pull', '--quiet', '--ff-only'], { stdio: 'inherit' })
  }

  mkdirSync(into, { recursive: true })
  for (const id of sending) copyFileSync(join(CLIPS_DIR, `${id}.fbx`), join(into, `${id}.fbx`))
  execFileSync('git', ['-C', ASSETS_CLONE, 'add', ASSETS_PATH], { stdio: 'inherit' })
  const message =
    sending.length === 1
      ? `Add the ${sending[0]} clip`
      : `Add ${sending.length} Mixamo clips\n\n${sending.map((id) => `- ${id}`).join('\n')}`
  execFileSync('git', ['-C', ASSETS_CLONE, 'commit', '--quiet', '-m', message], { stdio: 'inherit' })
  execFileSync('git', ['-C', ASSETS_CLONE, 'push', '--quiet'], { stdio: 'inherit' })
  say(`  pushed ${sending.length} to ${ASSETS_PATH}`)
}

// --- the run ----------------------------------------------------------------

if (!existsSync(CLIPS_DIR)) {
  say(`Nothing at ${CLIPS_DIR}. See public/models/animations/README.md.`)
  process.exit(0)
}

say(dryRun ? '\nCLIPS · dry run\n' : '\nCLIPS\n')

// 1. Names. What each file is called on disk and what it is called from here
// on, which are the same thing after the rename and are not during a dry run.
const onDisk = readdirSync(CLIPS_DIR).filter((f) => f.toLowerCase().endsWith('.fbx'))
const named = []
for (const file of onDisk) {
  const id = kebab(file)
  if (`${id}.fbx` === file) {
    named.push({ file, id })
    continue
  }
  if (!id || id.startsWith('mixamo-com')) {
    complain(`${file} is Mixamo's own file name, not an animation's. Rename it after the move.`)
    continue
  }
  // Asked of the directory listing rather than the filesystem, which on a Mac
  // is case-insensitive and would report `Defeat.fbx` as proof that
  // `defeat.fbx` is already taken — by itself.
  if (onDisk.includes(`${id}.fbx`)) {
    // Moving a download in on top of one that is already here is the ordinary
    // way this happens, and it leaves two names for one animation in a folder
    // every byte of which gets published. An identical copy is just tidied
    // away; one that differs is a re-export nobody has been told about, and
    // guessing which file is wanted is not this script's business.
    const same =
      readFileSync(join(CLIPS_DIR, file)).compare(readFileSync(join(CLIPS_DIR, `${id}.fbx`))) === 0
    if (!same) {
      complain(`${file} differs from the ${id}.fbx already here. Left alone — delete one.`)
      continue
    }
    say(`  ${file} is a second copy of ${id}.fbx${dryRun ? '' : ', removed'}`)
    if (!dryRun) rmSync(join(CLIPS_DIR, file))
    continue
  }
  say(`  ${file} → ${id}.fbx`)
  if (dryRun) named.push({ file, id })
  else {
    renameSync(join(CLIPS_DIR, file), join(CLIPS_DIR, `${id}.fbx`))
    named.push({ file: `${id}.fbx`, id })
  }
}
named.sort((a, b) => a.id.localeCompare(b.id))

// 2. What is here, and what the game already knows.
const known = new Set(
  [...readFileSync(REGISTRY, 'utf8').matchAll(/^ {2}'([a-z0-9-]+)': \{$/gm)].map((m) => m[1]),
)
const present = named.map(({ id }) => id)
const fresh = present.filter((id) => !known.has(id))

for (const id of known) {
  if (!present.includes(id)) complain(`${id} is registered but not in the folder.`)
}

say(
  `  ${present.length} in the folder · ${known.size} registered · ` +
    (fresh.length === 0 ? 'nothing new' : `${fresh.length} new`) +
    '\n',
)
say('  ' + ' clip'.padEnd(29) + '  secs played  fps  tracks     kb  travel   seam')
say('  ' + '─'.repeat(90))

// Everything is measured, not only what is new: a clip that has been re-exported
// with In Place on is the same id and a different file, and this is what notices.
// Each one through its own entry, so `travel` and `seam` describe the stretch the
// game plays rather than a stretch nobody will ever see.
const registryEntries = entriesOf(readFileSync(REGISTRY, 'utf8')).entries
const spots = new Map()
const travellers = []
for (const { file, id } of named) {
  const how = howPlayed(registryEntries.get(id))
  const m = measure(join(CLIPS_DIR, file), how)
  if (!m) {
    complain(`${id}.fbx has no animation, or no mixamorig:Hips. Not a Mixamo clip?`)
    continue
  }
  const spot = m.travel <= ON_THE_SPOT ? 'inPlace' : 'travels'
  spots.set(id, spot)
  if (spot === 'travels') travellers.push(id)
  const windowed = m.played < m.duration - 0.05
  const notes = [
    spot === 'inPlace' ? '' : 'travels',
    how.loop && m.seam >= JOLT_DEG ? 'jolts on loop' : '',
    m.fps === EXPORTED_FPS ? '' : `${m.fps} fps, not ${EXPORTED_FPS}`,
    how.hold ? 'held' : '',
  ]
  say(
    (fresh.includes(id) ? '  +' : '   ') +
      id.padEnd(28) +
      m.duration.toFixed(2).padStart(6) +
      (windowed ? m.played.toFixed(2) : '—').padStart(8) +
      String(m.fps).padStart(5) +
      String(m.tracks).padStart(8) +
      String(m.kb).padStart(7) +
      `${Math.round(m.travel * HIP_CM)} cm`.padStart(8) +
      `${m.seam.toFixed(1)}°`.padStart(7) +
      (notes.some(Boolean) ? '   ' + notes.filter(Boolean).join(', ') : ''),
  )
}

const registered = []
if (spots.size > 0) {
  say('')
  const { all, corrected } = register(spots)
  registered.push(...all)
  if (fresh.length > 0) {
    say(`  ${dryRun ? 'would register' : 'registered'} ${fresh.length}: ${fresh.join(', ')}`)
  }
  for (const line of corrected) say(`  ${dryRun ? 'would correct' : 'corrected'} ${line}`)
  say(`  ${all.length} clips in src/scene/clips.ts`)
}

if (travellers.length > 0) {
  say(
    `\n  ${travellers.length} walk off their mark and are registered as \`travels\`: ` +
      `${travellers.join(', ')}.`,
  )
  say('  The lab will show them. A card that names one fails the deck test, so')
  say('  give those a window that stays put, a `hold`, or a re-export from')
  say('  Mixamo with In Place on before choosing them.')
}

if (upload) {
  const used = usedIds(registered.length > 0 ? registered : [...known])
  const spare = (registered.length > 0 ? registered : [...known]).filter((id) => !used.includes(id))
  say('\n  uploading …')
  if (spare.length > 0) {
    say(`  ${spare.length} registered but named by nothing, so not sent: ${spare.join(', ')}`)
  }
  ship(used)
}

if (problems.length > 0) {
  say(`\n  ${problems.length} thing${problems.length === 1 ? '' : 's'} to look at:`)
  for (const line of problems) say(`  · ${line}`)
}

say(
  fresh.length > 0 && !dryRun
    ? '\n  Now look at them: npm run dev, then ?firetoy, and press 🎬.\n'
    : '',
)
