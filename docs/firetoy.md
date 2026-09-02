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
`Pose`, which would then mean nothing to the primitive fighters.

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

**Not done yet, on purpose:** finger poses, an idle tuned for a human rather
than a doll, and anything involving imported clips.

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
entry chunk is 319 kB with the lab as it was without it; `GLTFLoader` and the
catalogue sit in the lab's own 85 kB chunk until `?firetoy` asks for them.

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
battle asks of them.

This is where the six rivals get changed: open one, move a few pieces, copy the
result back into `cast.ts`.

It is not Customize. Nothing is saved and nothing is priced; the point is to
arrive at the six rivals' outfits with the real node names in hand.
