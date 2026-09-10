# The Firetoy characters

Two GLB files under `public/models/characters/` hold every character the pack
can make: one skeleton each, and the whole wardrobe skinned onto it as
overlapping meshes.

| | male | female |
|---|---:|---:|
| File size | 12.1 MB | 11.2 MB |
| Pieces (skinned mesh nodes) | 166 | 144 |
| Joints | 65 | 65 |
| Skins / materials / textures | 1 / 1 / 1 | 1 / 1 / 1 |
| Animations in the file | 0 | 0 |

`public/models/characters/FIRETOY_ASSET_MAP.md` is the inspection of the
original Unity pack and the source of truth for names, presets and rules. This
file records what the code does with it, and the two places the code has to
disagree with it.

## The parts of it

- `src/scene/firetoy/characterParts.ts` — the catalogue, generated from the
  naming pattern. Gender, category, design, colorway, side, and the exact node
  name for each of the 310 pieces.
- `src/scene/firetoy/characterPresets.ts` — the twenty characters Firetoy
  built, transcribed as explicit node lists.
- `src/scene/firetoy/outfit.ts` — what an outfit is, and the two rules.
- `src/scene/firetoy/FiretoyCharacter.tsx` — one character on the stage.
- `src/scene/firetoy/rig.ts` — the pose retarget (below).
- `src/scene/firetoy/mocap.ts` — the imported-clip retarget (below).
- `src/scene/clips.ts` — the registry of imported clips: four fields each.
- `src/scene/firetoy/handover.ts` — when a body belongs to the pose system and
  when to a clip, and the blend between. Pure.
- `src/scene/firetoy/clipPlayer.ts` — the half of that which writes bones.
- `src/scene/firetoy/useMocap.ts` — fetching a clip, once per file.
- `src/scene/firetoy/cast.ts` — who wears what: the six rivals, the four
  hot-seat bodies, and which piece each unlockable accessory really is.
- `src/scene/FiretoyFighter.tsx` — one of them standing on a mark in a battle.
- `src/ui/CharacterLab.tsx` — the wardrobe range, at `?firetoy`.

## An outfit is a list of node names

```ts
<FiretoyCharacter gender="male" outfit={FIRETOY_PRESETS.male07} />
```

Everything not in the list is hidden. The GLB arrives with all 166 pieces
visible at once, so a character who has not been dressed is a heap; `applyOutfit`
always hides the whole wardrobe before showing an outfit.

"None" is the absence of a name. Unity had empty GameObjects standing in for the
none option in each category and they were not exported, so there is no mesh for
"no hat" — only a hat that is not in the list.

While an outfit is being *edited* it is an `OutfitChoice`: one node per
category, plus anatomy as a checklist, because the original presets switch head,
eyes, lashes and bra on one at a time and never choose between them.
`resolveOutfit` turns a choice into the node list, and `choiceFromOutfit` reads
one back — which is how a preset opens in the lab.

## The two rules

Only two, because they are the only ones the asset demonstrates:

1. **Fullbody replaces torso, trousers and shoes.** All four presets wearing a
   `Full_Body` leave those three categories empty.
2. **Gloves are worn as a matching pair.** Every preset with gloves has the
   same design and colorway on both hands, and on the male body it could not be
   otherwise: the bare hands are one combined mesh, so "one glove" would show a
   bare left hand inside the right glove.

And the ones deliberately *not* implemented:

- Hair and a hat are **not** exclusive. Male 07 wears both.
- Glasses with a mask, and a hat with headphones, are allowed. No preset
  combines them, but nothing in the pack forbids it, and untested is not the
  same as invalid.
- No anatomy is switched on by inference. `Male_Body` and `Fem_Body` are
  inactive in all twenty presets, male 05, 08 and 09 wear no eyes, and female 01
  wears a bra under a torso. Those are kept as shipped.

Colorways `_1`, `_2`, `_3` are real separate meshes, not tints. There is no
runtime recolouring, and there cannot be a cheap one: every piece in a file
shares a single material, so mutating it would repaint the whole character.

## Two discrepancies with the asset map

Both are cases where the map describes the *file* correctly and three describes
it differently once loaded.

**1. The loader strips full stops from node names.** `GLTFLoader` puts every
node name through `PropertyBinding.sanitizeNodeName`, which removes `. [ ] : /`
and turns whitespace into underscores. So Firetoy's famous
`Ib_MALE_01_Male_Eyebrows_10_1.` — which really does end in a full stop in the
prefab, the FBX and the GLB — is reachable in a loaded scene as
`Ib_MALE_01_Male_Eyebrows_10_1`, and every bone loses its dot too: `Arm.L`
becomes `ArmL`, `HandIndex1.L` becomes `HandIndex1L`. 59 male and 58 female
nodes are renamed this way; none of them collide afterwards, so the loader adds
no numeric suffixes.

The catalogue keeps the names the files contain, because that is what every
other tool will show. `loadedName()` is the single place the translation
happens, at the moment of looking a node up in a scene.

**2. The finger bones are named `HandThumb1.L`, not `Thumb1.L`.** The map's
armature diagram (§2) shortens them; the files spell them out. The rest of the
diagram is exact.

Everything else in the map checked out against the files: 166 and 144 mesh
nodes, 65 joints, one skin, one material, one image, no animations, and all
twenty presets match piece for piece — `characterPresets.test.ts` reads the
map's own tables back out of the Markdown and compares.

## The cast

Six rivals, alternating male and female down the ladder, no two sharing a
silhouette. Each was built from one of the twenty originals with a few pieces
changed, because a preset Firetoy drew already hangs together.

| Rival | Body | Built from | What you see |
|---|---|---|---|
| THE ROOKIE | male | new | Green safety helmet, beige shirt, jeans |
| 67 KID | female | female 02 | One-piece suit, big shades, blonde hair |
| THE MEWER | male | male 05 | Long hair, studio cans, no beard |
| THE SHOWOFF | female | female 08 | Giant chicken head over a red jacket |
| THE GAMBLER | male | male 09 | Paper bag over the head, beard, jeans |
| AURA DEMON | female | female 09 | Blue rabbit mask, hair, yellow boots |

**A rival wears the accessory their challenge pays out.** That is the one rule
the cast has to obey, and `cast.test.ts` is what keeps it true — it reads each
rival's third objective, looks up the Firetoy piece behind that accessory id,
and checks the rival is wearing it.

| Accessory | Rival | Firetoy piece |
|---|---|---|
| Safety Helmet 🪖 | THE ROOKIE | `Hat_2_1` |
| 67 Shades 🕶️ | 67 KID | `Glasses_2_1` |
| Studio Cans 🎧 | THE MEWER | `Headphones_1_1` |
| Drip Jacket 🧥 | THE SHOWOFF | `Torso_5_3` |
| Lucky Gloves 🎲 | THE GAMBLER | `Gloves_2_3`, both hands |
| Demon Mask 😈 | AURA DEMON | `Mask_2_3` |

Three of the six used to be things the pack does not contain — a chain, a
charm, a ring of light — so they were replaced by pieces that do. Their **ids
are unchanged**, because a player's unlocks are saved under them, which is why
`jawline-chain` is a pair of headphones. The accessory slots are now the
wardrobe's own categories rather than nine invented ones.

The player wears `DEFAULT_PLAYER_CHARACTER` until there is a Customize screen
to change it in: deliberately plain, and deliberately not wearing anything the
ladder pays out, so the six accessories read as new when they arrive. Hot-seat
battles hand out one body per character the setup offers, so two people on one
phone are not the same person twice.

## Starting the game

The title is a Firetoy character now — one of them, the player's own, on the
mark between the name and the PLAY button. It used to be the four primitive
fighters in a ring, which cost nothing to download and was a picture of a cast
the game no longer has.

What replaced the ring is a loading screen:

```text
app start
  → splash (HTML and CSS, in the entry bundle)
      waits for: the scene chunk, and firetoy-male.glb
  → title, with the character on it
      then, in the background: firetoy-female.glb
```

`SplashScreen` is the one screen in the game that may not import three.js. It
is plain markup in the entry bundle, on screen before the 3D chunk has been
asked for, and it waits for exactly two things — the scene module and the male
body. Not the female body, not the sounds, not the battle's stage.

It cannot ask three.js whether it is ready, because knowing would mean
importing it. So the scene says so instead: `TitleShowcase` takes a `report`
callback and calls it on the first frame it can actually draw. That is also
what starts the female body downloading, at the point where nothing is waiting
on it — by the time anyone reaches a female rival or the hot-seat setup, it is
usually already in. A clone with no bodies at all settles the splash from
`BodyBoundary` instead, and the title comes up empty rather than not at all.

**The entry bundle must not grow.** Three, drei, `useGLTF` and anything that
touches them belong behind a dynamic import; a `preloadFiretoy` call from a
screen in the entry chunk was once enough to pull all of three.js into the
first download and take it from 320 kB to 1.3 MB. The splash is the shape that
keeps that honest: it is what the entry chunk is allowed to contain.

## Where the primitives are still used

Nowhere, as of the new title — and that is worth knowing rather than acting on.
`Performer` still renders the old primitive `Fighter` when the look it is given
carries no Firetoy character, and every look now carries one. The branch, and
`Fighter` / `Drip` / `dripAnchors` behind it, are unreachable. Pulling them out
takes `Accessory.shape`, `bySlot`, most of `builds.ts` and the non-Firetoy half
of `framing` with them, which is a bigger job than deleting three files.

**Every scene catches the wait inside its own canvas.** A body is twelve
megabytes, so the component showing one suspends, and the screens already wrap
their scene in a `<Suspense>` for the lazy import of the scene module itself.
Suspending against *that* boundary unmounts the `<Canvas>`: the renderer logs
"Context Lost", the floor and the lights go with the fighter, and the stage
comes back only once the file has arrived — which is what tapping a rival of
the other gender used to do. The boundary belongs inside the canvas, around the
fighter and nothing else. `loading.test.ts` is what keeps it there.

## The animation probe

The game animates with a `Pose`: fifteen numbers, written for the primitive
fighters, whose arms are groups hanging straight down from a shoulder with no
rotation of their own. `rig.ts` drives the Firetoy skeleton from the same
fifteen numbers. `mewing`, `stare` and `speedrun` were run on `Ib_MALE_04` and
all three read as themselves.

**Is the rig directly compatible?** No, and it did not need to be. A pose value
cannot be written into a bone's rotation, because a Blender human bone points
along its own local +Y toward its child and the shoulders sit at odd angles.
What works is applying the pose as a rotation *on top of* the rest pose, about
the axes the pose meant — which are the body's, not the bone's:

    q_local = P⁻¹ · Δ · P · q_rest        (P = the parent's world rotation)

**Do we need retargeting?** Only that, and one correction. The Firetoy rest pose
is an A-pose: the arms already hang 39.3° out from vertical, measured off the
rig at load rather than assumed. Without subtracting it, `mewing`'s armRaise of
0.9 lands 39° wider than the move was drawn and the hands meant for the jawline
end up out at shoulder height. Subtracting it, mewing frames the jaw.

The elbow is the one joint that cannot use a body axis: once the arm is raised,
"bend forward" only means something in the forearm's own frame. Its local Z is
the hinge, and the two arms are mirrored, so the right one folds the other way.

**Runtime or offline?** Runtime, and it is already done — the whole retarget is
`rig.ts`, about sixty lines, and it costs one quaternion multiply chain per
joint per frame for eleven joints. There is nothing to convert offline: the GLBs
contain no animation clips, and the game's moves are functions, not clips. An
offline pass would only be worth it if the game later wants motion-captured or
authored FBX clips.

**Do hands and fingers work?** The fingers are in the skeleton — five chains of
four per hand — and they deform correctly with the arm, because they are skinned
like everything else. But a `Pose` has no fingers in it, so they stay in their
rest curl. Poses that want a fist or a point would need finger numbers added to
`Pose`, which would then mean nothing to the primitive fighters. An imported
clip has no such problem: thirty of the fifty-two rotations in the first one are
fingers, and they arrive for free.

All seventeen card gestures, the crouch before one, both sides of a judgement
and the two endings now run on it: `poseForAction` is shared with the primitive
fighters, so the two cannot drift into performing different things, and the
lab's action chip cycles through every one of them. The extremes are where a
retarget shows: `reactPose('PERFECT')` asks for an armRaise of 2.7, and with
the A-pose subtracted the arms end up overhead in a V, which is what it means
on a primitive too.

Movement personality still comes from the primitive build behind the fighter —
how much they bounce on the spot, how far a move overshoots. A rival's body
changed; their timing did not.

**Not done yet, on purpose:** finger poses and an idle tuned for a human rather
than a doll. Imported clips are the section below.

## Imported clips

It started as one clip, to answer the same kind of single question the pose
probe answered: can motion captured for somebody else be made to play on a
Firetoy body? It can, so now everything a fighter does is one.

The files are Mixamo exports — FBX binary, Without Skin, 30 fps, no keyframe
reduction, In Place wherever the site offers it. Twenty-six are registered and
twenty-one are performed: eleven between the eighteen cards, ten more for
standing still, the beats a result can be worth, and the two endings.
`?firetoy` has a 🎬 chip that steps the registry on whichever body and outfit is
on stage, and the action chip beside it walks the direction itself — every card
and every reaction, each showing the clip it was actually given.

### The rig is the same rig

The two skeletons are the same sixty-five joints, in the same order, with the
same "+Y points at the child" convention. The names differ by one rule:

| Mixamo | Firetoy |
|---|---|
| `mixamorig:Hips` | `Hips` |
| `mixamorig:Spine1` | `Spine1` |
| `mixamorig:LeftForeArm` | `ForeArm.L` |
| `mixamorig:RightHandThumb1` | `HandThumb1.R` |
| `mixamorig:LeftToe_End` | `Toe_End.L` |

Run over both files, that rule is a bijection: 65 names in, 65 distinct names
out, nothing unmapped on either side and nothing left over. Firetoy's rig came
out of Mixamo, renamed.

**So the retarget is a rename.** A clip states, per bone and per frame, where
that bone points; a local rotation is that orientation with the parent's taken
off. When every bone maps and both rigs agree on their axes, the parent's
orientation is the same on both sides and cancels — the source's local rotation
*is* the target's, verbatim. `mocap.ts` is that, plus the two things below.

**The A-pose does not enter into it, and that is the opposite of `rig.ts`.** A
`Pose` is a delta laid over whatever the body was doing, so it has to subtract
the 39° the arms already hang out at. A clip is absolute: it overwrites all
fifty-two bones it touches, so the rest pose is simply gone for the duration,
and subtracting the A-pose would bend the move instead of fixing it. Measured,
the two rest poses disagree by this much — none of which had to be corrected:

| | apart at rest |
|---|---:|
| hips, spine, neck, head | 0.7–7° |
| shoulders | 20° |
| arms and forearms | 51–53° |
| hands | 81° |
| fingers | 60–136° |
| legs, feet, toes | 7–12° |

### The two things that are not renames

**The hips translation.** It arrives in the source rig's centimetres and has to
land in metres, on legs of a different length. One ratio does both — hips height
to hips height — applied to the offset from each rig's own rest, so a body keeps
the place its own file put it and only borrows the motion.

**The track name.** `GLTFLoader` strips full stops out of node names, so the
bone the file calls `Arm.L` answers to `ArmL` once loaded. A track named
`Arm.L.quaternion` would not merely miss it: three reads that as node `Arm`,
property `L`. Every name goes through `loadedName`, the same as everywhere else.

### What the file turned out to contain

| | |
|---|---|
| Bones | 65, no meshes — Without Skin |
| Clip | `mixamo.com`, 2.90 s, 88 keys at 30 fps |
| Tracks | 53: fifty-two rotations and the hips' travel |
| Of those, fingers | 30 |
| Bones the clip never touches | 13 — ten finger tips, `HeadTop_End`, two `Toe_End` |

The thirteen keep Firetoy's own rest, which is what you want: they are leaves
with nothing hanging off them.

**It loops exactly.** The last frame equals the first to a tenth of a degree on
every track, hips included, so it repeats without a seam — at the cost of one
frame of hold, 33 ms, where the two identical frames meet. Not worth trimming.

**In Place took, mostly.** The hips still sway 2.8 cm across and 5.7 cm
fore-and-aft, and end exactly where they started. That is a body shifting its
weight, not walking off the mark, and there is no drift to cancel.

### On the two bodies

| | male | female |
|---|---:|---:|
| Hips at rest | 0.981 m | 1.069 m |
| Scale applied to the hips travel | ×0.941 | ×1.025 |
| Tracks that find their bone | 53 / 53 | 53 / 53 |
| Lowest the feet go, over the whole clip | −13 mm | −6 mm |

The feet are the number that would have shown a bad retarget, and −13 mm on the
male body is the rig's shin being 3 cm shorter than the one the motion was
captured on. It reads as standing on the floor. If a clip ever lands worse than
this, the fix is a ground offset per clip, not a cleverer retarget.

### Cost

| | |
|---|---:|
| Parse the FBX (591 kB, one clip) | 18.6 ms |
| `retargetToFiretoy`, per character | 15 µs |
| `mixer.update`, per frame, 53 tracks | 4.4 µs |
| Copied per character rather than shared | 1.4 kB |

Only the hips track is rebuilt per body; the fifty-two rotations are handed on
by reference, because nothing writes to a keyframe track once it exists.

**No frame rate is quoted here on purpose.** The preview pane throttles
`requestAnimationFrame` while it is off screen — the same artefact the section
below describes — and the lab's own readout while a clip plays is that, not the
clip. Four microseconds a frame is the cost.

**Runtime or offline?** Runtime, decided and paid for. Now that a card performs
a clip, `FBXLoader` is in the stage chunk every 3D screen loads: it went from
1054 kB to 1106 kB, **+16.7 kB gzipped**, and the entry chunk did not move at
322 kB. The alternative was baking the retarget offline into a GLB and shipping
keyframes alone, which would save that 16.7 kB and cost a build step; at one
clip, and 15 µs to retarget it, there is nothing to buy. Worth revisiting if the
game ever ships a dozen — and a baked clip would still be Mixamo's, so it takes
the same private-repo route as the bodies either way.

## The handover

**`neutral-idle` owns the skeleton.** All sixty-five bones, every frame, written
before anything else — see `writeBase` in `clipPlayer.ts`. Everything a fighter
is asked to do is a *performance* laid over that and blended against it, and a
performance that ends hands the body straight back to the idle underneath.

    idle ──▶ in ──▶ performing ──▶ out ──▶ idle
             ▲                      │
             └──────────────────────┘   something dealt while another fades out

A performance is a clip if the action has one, and the `Pose` the action carries
if it does not — the 400 ms wind-up, a GOOD (which is a nod), and any body whose
clip file never arrived. Both go through the same blend and the same ending,
which is the point: whichever it is, it cannot appear or vanish on a single
frame, and it cannot outlive its own span.

Four phases and no more, in `handover.ts`, which is pure and tested rather than
stared at. `clipPlayer.ts` is the half that writes bones, and both blends are
the same three steps: **capture** all sixty-five bones on the frame a blend
begins, **write the target** over the whole skeleton, and **pull back** toward
the capture by however much of the blend is left. In 180 ms, out 280 ms — the
two ends are not the same job, because coming in the performance is the thing
that was asked for and should arrive, while going out the body is settling back
to standing and a fast settle reads as a cut.

### How a fighter used to freeze

This shape is a rewrite, and what it replaced is worth keeping because both
failures were invisible from the code and obvious on a phone.

**Fifty-four unclaimed bones.** The base used to be the rig's rest pose plus a
`Pose`, and a `Pose` is eleven joints. The rest were written once, on the frame
a blend out finished, and never again — so any action that arrived without a
clip left them exactly where the last clip had put them, fingers curled, for as
long as that action lasted. Now the rest pose goes down first and the resting
clip over it, both of them every frame, so the floor is absolute and nothing
above it has to be careful.

**A pose that never came back down.** `reactPose`'s PERFECT throws the arms up
with `snap(p * 2)`, and `snap` is clamped: it reaches 1 half way through the
span and stays there. The span is 900 ms and the resolve screen stays up until
somebody swipes, so the fighter held their arms over their head for the rest of
the turn. Every other shape in `animations.ts` happened to be wrapped in `arc`
or `hold` and returned to standing by luck rather than by rule; `overSpan` is
now that rule, and `animations.test.ts` holds every beat to it at both ends.

The seam table below had already measured this and written it down as merely
the loudest frame in the cycle. A 39° single-frame turn was the bug, described.

**Everything is a function of the game clock.** The playhead is
`now - startedAt`, never an accumulation of frame deltas, so a paused game holds
its frame (`now()` stops), a slow frame does not drift, and two fighters — or a
reload — cannot disagree about where in the clip they are. The resting loop is
on the same clock, offset per body by `REST_STAGGER_MS` so that two fighters do
not breathe in unison. A clip that arrives after the card it belongs to is
joined in progress rather than restarted.

### The clip is read, not played

There is no `AnimationMixer`, and the reason cost an afternoon.
`PropertyMixer.apply` compares what it is about to write against what it wrote
last time and skips the assignment if they match — sound when the mixer owns
the skeleton, wrong here, because the pull-back moves those same bones behind
its back. During a blend in the playhead is pinned to the clip's first frame,
so the mixer wrote it once and then went quiet: every frame after that blended
toward the *rest* pose instead of the clip, and the body snapped **51.66°** into
place the moment the playhead moved. Reading the tracks' interpolants directly
is fewer moving parts than working around that, and they are the same
interpolants the mixer would have used.

### What the seams measure

The furthest any single bone turns in one frame, at 60 Hz, through each
transition — asked as a *share* of the whole distance that transition covers
rather than as an angle, because how far the body has to travel belongs to the
clips and not to the blend. A cut puts all of it in one frame; an eased blend
over the shorter of the two windows peaks near a seventh.

| transition | share of the move in its worst frame |
|---|---:|
| idle → performing | 0.14 |
| performing → next performing | 0.14 |
| a performance running out → idle | 0.09 |
| a performance cut short → idle | 0.09 |
| a clip → a pose the clip never touched | 0.09 |

`clipPlayer.test.ts` holds all five under 0.35 and asserts that something
actually moved, so a transition cannot pass by standing still. Taking the body
is the tightest of them, which is what the in blend is sized against: a
performance arrives at whatever frame it opens on, where a return only ever has
to reach standing.

Every finger ends a cycle exactly on its rest rotation, as do the twelve bones
no clip ever touches, and the hips stay on the mark they started on.

### Cost of a frame

| | |
|---|---:|
| A pose frame — the other sixteen cards | 2.9 µs |
| A clip frame — 53 tracks read and written | 4.2 µs |
| A blend frame — rest, clip, 65 slerps | 4.1 µs |

## The clips desk

`npm run clips` is what stands between a Mixamo download and the game.

    npm run clips                 look at what has arrived, and register it
    npm run clips -- --upload     and push the registered files to the assets repo
    npm run clips -- --dry-run    say what either would do, and change nothing

It settles the **name** first — Mixamo exports whatever the button said, and the
file name is the id the registry, a card's `animation` and the lab's chip all
use — then **measures** what the download page does not tell you, then
**registers** and, asked to, **ships**.

Two measurements decide whether the game can play a clip at all, and both are in
the keyframes rather than on the page you downloaded it from:

**Does it stay on its mark?** The furthest the hips get from where they started,
across the floor, in hip heights — which is near enough centimetres, because a
Firetoy hip stands at 0.98 m on the male body and 1.07 m on the female.
Every clip downloaded so far answers this with a gap you could drive through:
dancing on the spot tops out at 31 cm of weight shift, walking starts at 67 cm,
and there is nothing whatsoever in between. The line sits at 45 cm for that
reason rather than because it is a round number, and the gap has survived every
batch that has arrived since — including the acrobatics, which are not close to
it: a running forward flip covers 4.2 metres.

What is over the line is registered as `rootMotion: 'travels'`, which is a fact
about the file and not a plan. It earns a clip a place in the lab, where it can
be judged, and nothing else: a card that names one fails the deck test. The way
out is to re-export from Mixamo with In Place on and run the desk again, which
re-measures every file it finds and corrects the entry.

The other thing the table is good for is catching an export that came down on
different settings — one clip arrived at 66 fps rather than 30, which breaks
nothing, because playback reads keyframes against the clock, and is twice the
file for the same motion.

**Do its ends meet?** The worst any one bone has to turn to get from the last
frame back to the first. Mixamo's loops are exact, so this is mostly 0.0° and
the interesting entries are the ones that are not: dancing twerk at 19° would
jolt every time round, so it is a clip to play once.

New entries are registered played-once at their own speed, because which card
performs what is a decision for somebody in front of the lab, not for a script
that has never seen the animation.

### Registered is not performed

The registry holds every clip that has been downloaded and stood up, and not all
of them are used. `USED_CLIPS` in `animations.ts` is what something names, split
into `DEALT_CLIPS` — what a card can deal — and `STATE_CLIPS`, which is standing
still, the beats a result can be worth, and the two endings. Those two are the
only lists anything preloads, and `--upload` sends only the union. The registry
is already tens of megabytes of FBX; fetching all of it before a battle in order
to play one card would be an unusually thorough way to waste somebody's data.

### What the pose system still owns

Every card and every reaction is a clip now. `Pose` is not dead, and three
things keep it alive:

- **The wind-up.** 400 ms, which is three frames longer than the blend that
  would introduce a clip. There is nothing left to see, so `windUpPose` is the
  only thing that performs it.
- **The bed under every clip.** `clipPlayer.ts` blends *toward* a pose at both
  ends of a clip, so `idlePose`, `reactPose`, `watchPose` and `finalePose` are
  what a body eases out of and back into sixty times a second. Deleting them
  would not save a frame; it would remove the thing the blend blends to.
- **A clone with no clips.** The FBX files are Adobe's and gitignored, and the
  game runs without them — a card is performed as a held idle and the console
  says so once. The four reaction poses are why a fighter without the licensed
  files still celebrates and slumps rather than standing there.

What is genuinely unused is `MOVES` — the seventeen hand-authored card gestures
— along with `moveAt`, `moveFor` and `flourish`. No card names one, and
`poseForAction`'s move branch only reaches them for an animation key that is not
a registered clip, which no card can now produce. They are kept for the moment
because the lab still steps through them and because a card can be moved back
onto one by changing a single string, which is the cheapest possible way to
disagree with the direction. They and the unreachable `Fighter` above are one
deletion, when somebody is sure.

### Playing a stretch of one, and holding it on its mark

Two fields on an entry, both added when the whole game moved onto clips, and
both worth the room they take.

**`startTime` / `endTime`** name the seconds to play. Three separate problems
wanted it. `angry` is nineteen seconds and no card is four, so a card would
have played the opening and cut away from it. Several clips stand still for a
while and *then* walk, and the stretch before the walk is a whole card —
`taunt` gestures until 3.90 and steps after it. And one file can then serve two
cards that want different lengths of it, without being fetched twice. The
window keeps the keyframes straddling both bounds, so it covers what was asked
for rather than stopping a frame short, and re-bases the first to time zero.

**`hold`** takes the drift out of the hips. It is deliberately not a pin:
pinning would take the weight shift with it — a dance moves its body over a
planted foot by 20–30 cm every bar, and the foot pays for none of that — so the
feet would skate. Instead each frame has the average of its neighbours within
`DRIFT_SECONDS` subtracted, which drops what is slower than a second and a half
and leaves the sway exactly where it was. Y is never touched, or a backflip
would land on the floor it left.

Neither is a timeline editor: two numbers, a flag, no easing, no second window.

**What it bought.** Of the nine clips that walk, four are usable and five are
not. `backflip` holds — most of its 74 cm is airborne, so removing it costs 12
cm of foot slide per second, which reads as a pivot. `gangnam-style`,
`swing-dancing` and `taunt` need no hold at all: a window of each stands still
by itself. `bboy-uprock`, `breakdance-footwork-to-idle` and `capoeira` skate at
29–69 cm/s however they are windowed or held, and `butterfly-twirl` and
`running-forward-flip` are locomotion at 81 and 107 — those five stay in the lab
and out of the game.

A held clip never lands at exactly zero, and cannot: the moving average on the
first frame only has the half of its window that exists, so it lags by up to
half a window's travel. That residual is the 27 cm the desk still measures on
the backflip, and it is at the two ends, where the fighter is standing.

### Not answered yet

- **Root motion, properly.** What is here removes a journey; it does not carry
  one. A clip that is *meant* to end somewhere else — a step in, a knockdown —
  still has nowhere to put the fighter, because the stage's marks are fixed and
  the logical position of a player never moves. Five clips are unused for
  exactly this reason.
- **A second clip.** Everything above is written for one. Two clips on one body
  in quick succession is handled — a new clip blends in from wherever the last
  one left off — but two clips *at once*, or a clip layered over a pose, is not.
  A GOOD is still a pose nod for want of it.
- **Two gestures the pack does not contain.** 😤 Mewing is hands framing the
  jaw with the chin up, and ✌️ Six Seven is both hands alternating on the count.
  Neither is in Mixamo's catalogue at all. They perform `being-cocky` and
  `hokey-pokey`, which are the right *register* and the wrong gesture, and they
  are the two cards worth recording specifically. 🧘 Levitate is a lesser third:
  nothing in the pack leaves the ground for long enough.

## Performance

Measured on the real files. The per-frame figures are from Node against the
parsed GLBs; the transfer figure is the dev server on localhost.

| | male | female |
|---|---:|---:|
| Transfer | 12.1 MB in 218 ms | 11.2 MB |
| Parse | 28 ms | 19 ms |
| `SkeletonUtils.clone`, per character | 3 ms | 1 ms |
| Triangles in the whole wardrobe | 230k | 267k |
| `updateMatrixWorld` over the armature, per frame | 26 µs | 12 µs |
| `applyOutfit` (hide 166, show 10) | 2 µs | 3 µs |

**Hidden pieces cost almost nothing.** `WebGLRenderer.projectObject` returns
before it does anything at all for an object with `visible === false`, so a
hidden piece is never drawn, its skeleton is never updated, and its geometry is
never even uploaded to the GPU — `info.memory.geometries` only counts pieces
that have been rendered once. What remains is the matrix walk over ~232 nodes,
which is 26 µs of a 16 ms frame, and the skeleton updates for the pieces that
*are* visible, at about 1.7 µs each.

`SkeletonUtils.clone` gives every skinned mesh its own copy of the skeleton, so
a cloned character carries 166 of them where the file had one. Only the visible
ones update, and the bone matrices are 4 KB each, so this is ~690 KB per
character and no per-frame cost.

**So: nothing to optimise yet.** The cost is the 12 MB download, not the hidden
wardrobe. Splitting the GLBs would only pay off if the game needed to ship less
than a whole wardrobe — worth revisiting when the six rivals' outfits are fixed
and it is known how much of the catalogue the game actually uses.

None of this reaches the game's first load. `CharacterLab` is behind a lazy
import, the way every other screen that opens a 3D stage already is, so the
entry chunk is 322 kB with the lab as it was without it; the catalogue and the
lab's own loaders sit in a 59 kB chunk until `?firetoy` asks for them, and
`GLTFLoader` is in the stage chunk every 3D screen already loads.

Frame rate was not measured here: this machine's preview pane throttles
`requestAnimationFrame` to a standstill while it is off screen, so every reading
it produced was an artefact. The lab prints live fps in its own header — open it
and read it there.

## The lab

```
npm run dev
# ?firetoy, ?firetoy=female07 for an original, ?firetoy=the-gambler for a rival
```

Male or female, any of the twenty originals or any of the game's own cast,
then every category by design and colorway with `none` one step below the first design, anatomy as toggles, and
the exact node name of whatever was last touched along the top. `×2` puts a
second character on stage in a different preset — the proof that two instances
of one cached GLB keep their own wardrobes — `copy` puts the current outfit on the clipboard
as TypeScript, and the action chip runs the fighter through everything a
battle asks of them. 🎬 swaps all of that for the imported clip — looped, which
the battle does not do, because in here the point is to watch one motion over
and over and catch the two seams. It stays dark on a clone that has not
downloaded a clip.

This is where the six rivals get changed: open one, move a few pieces, copy the
result back into `cast.ts`.

It is not Customize. Nothing is saved and nothing is priced; the point is to
arrive at the six rivals' outfits with the real node names in hand.
