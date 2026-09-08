# Imported clips

Motion captured elsewhere and retargeted onto a Firetoy body at load. The files
are **not in this repository** — they are Adobe's to hand out, not ours — so
they are gitignored, exactly like the character models next door. See
`public/models/characters/README.md`, which explains the same arrangement at
more length, and `docs/firetoy.md` for what the code does with a clip.

Registered clips are listed in `src/scene/clips.ts`; `npm run clips` puts them
there. Being registered only means it has been downloaded and can be looked at
in the lab — a clip is not performed until a card names it, and today one does:
`being-cocky` is 🕶️ Sigma Stare.

## Adding one, from nothing

**1. Download it.** [mixamo.com](https://www.mixamo.com), with an Adobe
account, and export:

```text
Format              FBX Binary (.fbx)
Skin                Without Skin
Frames per Second   30
Keyframe Reduction  none
In Place            on, wherever the animation offers it
```

**Without Skin** matters: the clip is retargeted onto a Firetoy skeleton, so
the only thing wanted out of the file is the joints and their keyframes. A
skinned export is a whole second character nobody will ever look at.

**In Place** matters too. The game has no answer for a fighter who walks off
their mark — `rootMotion` has one legal value — so an animation that travels
needs that box, or it needs a decision nobody has made yet.

**2. Drop it in here** and run the desk:

```bash
npm run clips
```

It renames the file to kebab-case if Mixamo did not — that name is the id the
registry, the card and the lab all use, so it is settled once and then never
changes — measures every clip in the folder, and writes the new ones into
`src/scene/clips.ts` played once at their own speed. What it prints is worth
reading:

```text
  clip                   secs  fps  tracks     kb  travel   seam
  hip-hop-dancing        5.20   30      53    606   21 cm   0.0°
  dancing-twerk         15.20   30      53   1510   25 cm  19.1°   jolts on loop
  capoeira               3.43   30      53    636  145 cm   0.0°   travels
```

**travel** is how far the hips get from where they started, across the floor.
Over 45 cm the clip is walking rather than dancing on the spot, and it is
registered as `rootMotion: 'travels'` — enough to look at it in the lab, and not
enough to give it to a card, which fails the deck test. Re-export it with In
Place on and run the desk again: it re-measures every file it finds, so the
entry corrects itself. **seam** is how far the last frame is from the first — near zero
means it can loop, and a clip like dancing twerk at 19° would jolt every time
round, so it is one to play once. Add `--dry-run` to any of this to see what it
would do and change nothing.

**3. Look at it.** `npm run dev`, then `?firetoy`, and step 🎬 ‹ › through the
registry — off the end either way is the pose system, so every clip is one press
from none at all. Switch bodies with ♂/♀: the retarget scales the hips travel to
the legs carrying it, and that is the thing worth checking on both. In the lab
clips loop whatever the registry says, so the blend in and the blend out are one
press apart.

**4. Give it to a card.** In `src/engine/cards.ts`, point that card's
`animation` at the id:

```ts
animation: 'being-cocky',   // instead of 'stare'
```

Nothing else changes. `animationFor` decides whether a key names one of the pose
functions in `animations.ts` or one of these, and nothing between the deck and
the skeleton knows the difference.

Two numbers are worth lining up while you are there. A clip starts 120 ms after
the card does — that is the blend — so a card whose `durationMs` is shorter than
`120 + duration ÷ playbackRate` will cut the motion off and blend out of it
early. That is handled and it looks fine; it is just not what the animation was
drawn to do.

**5. Check it.** `npm test && npm run lint && npm run build`. The deck test
fails if a card's animation names neither a pose nor a clip, so a typo in the id
is caught there rather than on a stage.

**6. Ship it.** The clip is licensed, so like the bodies it reaches production
from the private assets repository, and the desk puts it there:

```bash
npm run clips -- --upload
```

That clones `private-game-assets` into `.assets/`, copies the registered clips
into `aura-battle/mixamo/runtime/`, and commits and pushes them under this
repository's own git identity rather than the machine's.
`.github/workflows/pages.yml` sparse-checks-out that folder alongside the
characters one and copies the files back in here at build time. Everything in
`public/` is published, so a clip that no card performs is 600 kB nobody
downloads sitting at a public URL — a reason to upload once a card names it
rather than the moment it is registered. It **warns rather than fails** if
the folder is empty, because a missing clip costs one card its motion where a
missing body costs the game its cast — so a deploy that quietly ships an idling
Sigma Stare is possible. The warning in the build log is the thing to watch for.

## Without them

`npm test`, `npm run lint` and `npm run build` all pass on a clone that has no
clips, and the game runs. What you lose is the motion: a card whose animation is
an imported clip is performed as a held idle, and the console says so once —

```text
[aura] no clip at /models/animations/being-cocky.fbx — whoever performs it will hold a pose instead.
```

In the lab the 🎬 chip simply never lights up.
