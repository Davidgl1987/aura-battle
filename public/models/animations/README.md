# Imported clips

Motion captured elsewhere and retargeted onto a Firetoy body at load. The files
are **not in this repository** — they are Adobe's to hand out, not ours — so
they are gitignored, exactly like the character models next door. See
`public/models/characters/README.md`, which explains the same arrangement at
more length, and `docs/firetoy.md` for what the code does with a clip.

Registered clips are listed in `src/scene/clips.ts`; `npm run clips` puts them
there. Being registered only means it has been downloaded and can be looked at
in the lab. Twenty-one of the twenty-six are performed: eleven between the
eighteen cards, and ten more for standing still, the beats a result can be worth
and the two endings. The other five walk off their mark and stay in the lab —
see `docs/firetoy.md`.

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

**In Place** matters too, and it is still the cheapest way to get a clip that
stays put. An animation that travels can sometimes be rescued — by playing a
window of it that stands still, or by asking for its drift to be taken out — but
four of the nine travellers in the folder were rescued and five were not. Tick
the box if the site offers it.

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
  clip                          secs played  fps  tracks     kb  travel   seam
  hip-hop-dancing               5.20    3.07   30      53    606   21 cm 122.4°
  taunt                         5.17    2.43   30      53    648   23 cm  64.7°
  capoeira                      3.43       —   30      53    636  145 cm   0.0°   travels
```

**played** is how much of it the entry actually plays — its `startTime` to its
`endTime` — and an em dash means all of it. Everything to the right of that
column describes the played stretch and not the file, which is the whole point:
`taunt` walks after 3.90 seconds and the game stops at 3.90.

**travel** is how far the hips get from where they started, across the floor.
Over 45 cm the clip is walking rather than dancing on the spot, and it is
registered as `rootMotion: 'travels'` — enough to look at it in the lab, and not
enough to give it to a card, which fails the deck test. Three ways out, cheapest
first: re-export it with In Place on, give it a window that stands still, or add
`hold: true`. The desk re-measures every file it finds on every run, so the
entry corrects itself either way. **seam** is how far the last frame is from the
first; it only matters to a clip that loops, so that is the only kind it is
reported against. Add `--dry-run` to any of this to see what it would do and
change nothing.

**3. Look at it.** `npm run dev`, then `?firetoy`, and step 🎬 ‹ › through the
registry — off the end either way is the pose system, so every clip is one press
from none at all. Switch bodies with ♂/♀: the retarget scales the hips travel to
the legs carrying it, and that is the thing worth checking on both. In the lab
clips loop whatever the registry says, so the blend in and the blend out are one
press apart.

**4. Give it to somebody.** In `src/engine/cards.ts`, point a card's
`animation` at the id:

```ts
animation: 'being-cocky',   // instead of 'mewing'
```

Or, in `src/scene/animations.ts`, hand it a beat — `REACTS` is what the fighter
a result landed on does about it, `WATCHES` is the answer from across the stage.
Nothing else changes either way. `animationFor` decides whether a key names one
of the pose functions in `animations.ts` or one of these, and nothing between
the deck and the skeleton knows the difference.

Two numbers are worth lining up while you are there. A clip starts `BLEND_IN_MS`
after the card does — 180 ms, in `handover.ts` — so a card whose `durationMs` is
shorter than `180 + duration ÷ playbackRate` will cut the motion off and blend
out of it early. That is handled and it looks fine; it is just not what the
animation was drawn to do, which is what `startTime` and `endTime` are for. The
three ring holds do it on purpose: a hold has a ceiling of its own, and half of
`silly-dancing` is what fits inside it.

The other way round is a bug, and `clips.test.ts` fails on it. A clip that runs
out before its card does hands the body back to `neutral-idle`, and the fighter
stands there breathing — on screen, while the QTE is still being scored — until
the card is over. So `durationMs` is read off the clip rather than chosen:
`BLEND_IN_MS` plus whatever stretch of the file this entry plays, which is the
**played** column above.

**5. Check it.** `npm test && npm run lint && npm run build`. The deck test
fails if a card's animation names neither a pose nor a clip, so a typo in the id
is caught there rather than on a stage.

**6. Ship it.** The clip is licensed, so like the bodies it reaches production
from the private assets repository, and the desk puts it there:

```bash
npm run clips -- --upload
```

That clones `private-game-assets` into `.assets/`, copies in the clips something
actually names — asked of the source, so repointing a card is enough to change
what ships — and commits and pushes them under this repository's own git
identity rather than the machine's. A registered clip nobody performs is left
behind, and the run says which.
`.github/workflows/pages.yml` sparse-checks-out that folder alongside the
characters one, copies the files back in here at build time, and then **fails
the deploy if any clip the game fetches is missing**:

```bash
npm run clips:check
```

That is `src/scene/shipped.test.ts`, run with `VITE_REQUIRE_CLIPS=1` so that it
asks rather than skips, and the list it asks about is `USED_CLIPS` itself — the
same one `--upload` sends — so there is no copy of it in the workflow to fall
behind when a card is repointed. It used to warn, and only when the folder was
empty; one clip made it not empty, and a deploy went out with twenty of
twenty-one missing and every card but Mewing performed as a held idle. Everything
in `public/` is published, so a clip that no card performs is 600 kB nobody
downloads sitting at a public URL — a reason to upload once a card names it
rather than the moment it is registered.

## Without them

`npm test`, `npm run lint` and `npm run build` all pass on a clone that has no
clips, and the game runs. `clips.test.ts` — the one that measures the real files
— skips itself. What you lose is the motion: every card is performed as a held
idle, and the console says so once per file —

```text
[aura] no clip at /models/animations/being-cocky.fbx — whoever performs it will hold a pose instead.
```

The reactions still read, because those fall back to the pose system rather than
to standing still: a fighter without the licensed files still celebrates a
PERFECT and folds over a defeat. In the lab the 🎬 chip simply never lights up.
