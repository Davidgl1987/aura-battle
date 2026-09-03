# Firetoy characters

The two character bodies Aura Battle renders are **third-party paid assets**
and are **not in this repository**:

```text
firetoy-male.glb
firetoy-female.glb
```

They come from a commercial Unity character pack. The licence covers using them
in the game; it does not cover redistributing the models, so they are listed in
`.gitignore` and stay on machines that have their own copy.

## Running the game with them

Put both files in this directory, exactly under these names:

```text
public/models/characters/firetoy-male.glb
public/models/characters/firetoy-female.glb
```

Nothing else is needed — `npm run dev` picks them up from `public/`.

Do not commit them, and do not commit a reduced, re-exported or otherwise
derived version to get around the ignore rules. A smaller copy of a licensed
model is still the licensed model.

## Where the deploy gets them

The GitHub Pages workflow fetches them at build time from a private repository
that holds the licensed assets for several projects:

```text
private-game-assets/
└─ aura-battle/firetoy/runtime/
   ├─ firetoy-male.glb
   └─ firetoy-female.glb
```

`.github/workflows/pages.yml` sparse-checks-out only that one folder — a repo
holding a dozen projects' assets still costs one folder here — copies the two
files into this directory, and then builds. It needs an Actions secret,
`ASSETS_TOKEN`, holding a fine-grained token with read-only Contents access to
the assets repository, and it fails with a readable error rather than
deploying a characterless game if the models do not arrive.

The four values at the top of that workflow (`ASSETS_REPO`, `ASSETS_PATH`,
`ASSETS_DEST`, `ASSETS_CHECKOUT`) are the only project-specific part, so
another public project wanting a different folder copies the steps and changes
those.

## Running the game without them

`npm test`, `npm run lint` and `npm run build` all pass on a clone that has
neither file: nothing in the build reads the binaries, and the tests describe
the wardrobe from the naming pattern rather than from the files.

The game runs too, without falling over. What you lose is the characters: the
title, the rival select and the battle draw their stage with nobody standing on
it, and the console says so once per screen —

```text
[aura] no character body — the stage will be empty. …
```

That is `BodyBoundary` in `src/scene/`, which catches both the wait for a body
and its never arriving. Put the two files in and reload; nothing else changes.

## What is in here

`FIRETOY_ASSET_MAP.md` is ours: an inspection of the pack written for this
project — node names, the twenty original presets, and the rules the asset
really has. It contains no asset data, no geometry and no textures, so it is
versioned. `docs/firetoy.md` is what the code does with it.
