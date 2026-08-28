# Aura Battle

Answer the rival's move with a different kind of gesture, nail the QTE, and
push the shared aura bar onto their side before both decks run dry. Two players
on one phone, or one player up a ladder of six rivals.

**Play it: <https://davidgl1987.github.io/aura-battle/>** — portrait, on a
phone, with the sound on.

## Run it

```bash
npm run dev
```

Open it on a phone from the same network at the address Vite prints as
`Network:` — the game is portrait-first and built around thumbs.

```bash
npm test        # engine, QTE maths, scene, audio, balance
npm run build   # typecheck + production build
npm run balance -- --disable-console-intercept   # the balance table, printed
```

**QTE range** (dev only): `?qte` opens a range where you can repeat one card's
QTE as many times as it takes to tune it — `?qte=sturdy` starts on that card,
and the row of chips switches between all fifteen. `window.__game` is the live
store, for driving a phase from the console without playing up to it, and
`window.__audio` is the synth, for firing a sound without earning it.

## A match, start to finish

```
HOME ─┬─ PLAY ─┬─ SOLO  ──→ pick a rival ──────────────→ BATTLE ──→ RESULTS
      │        └─ LOCAL ──→ P1 deck → pass → P2 deck ──→ BATTLE ──→ RESULTS
      ├─ COLLECTION (what you own, and the deck you take in)
      └─ SETTINGS   (music, sfx, vibration, language)
```

There is one battle. Solo and local are the same reducer, the same QTEs and
the same scoring; the only difference is a field on the player:

```js
player.controller = 'human'   //  waits for a thumb
player.controller = 'cpu'     //  answered by engine/cpu.ts
```

### Local

Both players agree on two things: **cards per deck** (4–6)
and **time to choose** (3–5 s). Then each player picks a fighter — no two
players can take the same one — an optional alias, and their deck out of the
15 gestures. Both decks are open information: you can see what the rival
brought and count what they have left.

### Solo

Six rivals, hardest last. Each one is data — nine strategy weights and a deck —
so no rival has code of its own:

```js
strategy: {
  prefersFresh: 0.9,       // value on breaking the kind on the table
  prefersHighAura: 0.95,   // the best expected bill this turn
  prefersDifficulty: 0.55, // appetite for hard cards regardless
  prefersSafeCards: 0.4,   // weight on not fumbling
  chasesOutaura: 0.6,
  chasesMomentum: 0.8,
  qteSkill: 0.74,          // → PERFECT / GOOD / MISS odds
  consistency: 0.9,
  hesitates: 0,            // chance of freezing on the clock
}
```

The CPU never touches the glass: `judgeQte` draws its grade from the same
difficulty-scaled odds the balance simulation is measured with, so the rival a
player meets is the rival the numbers were tuned against. `rivals.test.ts`
measures the whole ladder with the shipped brain and fails if the climb
flattens — against a competent player it runs 88 / 74 / 54 / 49 / 41 / 15%.

Each rival always asks for three independent things: win the battle (a new
move), reach an aura total (Aura Coins), and one challenge (the accessory that
rival is wearing while you fail to do it). Every reward is paid once. Beating
them is what opens the next rival; the other two are optional, which is what
makes a rematch worth playing.

Nine of the fifteen moves are yours from the start — the three NORMAL cards of
each kind — and the six HARD ones are what the six rivals are holding. A rival
brings the move it is going to lose, so you watch it before you own it.

Every turn:

```
HANDOFF (waits for a tap)
   └→ CHOOSING (3–5s)  ──timeout──→  LOST COMPOSURE: momentum → 0, one card burned
        └→ PERFORM INTRO (0.4s) → QTE (card duration) → RESOLVE (1.2s) → rival's turn
```

**Your deck is your hand.** Everything you brought is on the table from the
first turn, a card is gone the moment you play it — or fumble it — and the
battle ends when both sides are out of cards.

Aura per play: `baseAura × judgement × freshness × momentum`.

- **Judgement** — PERFECT ×1, GOOD ×0.55, MISS costs you 35% of the card.
- **Freshness** — measured against the last card played *by either player*:
  a different kind is FRESH ×1.25, the same kind NEUTRAL ×1, the very same card
  STALE ×0.5.
- **Momentum** — 0–100 per player. PERFECT +25, GOOD +10, MISS −30, FRESH +10,
  STALE −10. At 100 you enter 🔥 GOD AURA (×1.6) until a MISS breaks it.

The match ends when the cards run out, or instantly (**MOGGED**) if the bar
reaches 85 on either side.

## Two languages

English and Spanish, a file each under `i18n/`. English is the source: the key
type is derived from it and the Spanish file is typed against that, so a
missing translation stops the build rather than showing somebody a raw key
mid-battle. `i18n.test.ts` also checks that every `{slot}` survives the
crossing — a `{name}` renamed in translation is the bug that prints
`{nombre}` at a player.

The game's own nouns do not translate. GRIDDY DROP is GRIDDY DROP, THE MEWER is
THE MEWER; only the words around them change. The language is picked from the
phone on first run and can be switched in Settings, from the hub or from the
pause menu.

## The three QTEs

**No two plays of a card are the same puzzle.** Every QTE gets a `variation`
drawn from the match seed when the phase opens: the control ring sets off from
a different spot along a different path, and the timing cursor starts from
whichever end the roll picked. Without it a card traced the identical route
every single time and stopped being a test of tracking after two attempts.
Because the number comes from the seed and not from `Math.random()`, a battle
still replays exactly.

**None of them starts until you touch the screen.** The card is already
committed by the time a QTE opens, so reaching for the glass is not part of the
challenge: the cursor sits parked, the ring holds still, the pads wait. On a
Timing card that first tap only starts the sweep — grading it against a parked
cursor would be a free MISS — while on a Speed card it counts, because
swallowing the first hit of a mash feels like theft. If nobody touches at all,
the QTE arms itself after `QTE_ARM_MS` so refusing to play cannot stall the
battle.

- **🎯 Timing** — a cursor sweeps the bar; tap it dead centre. Harder cards
  sweep faster, narrow the window, and ask for up to three taps in a row. One
  bad tap sinks the card.
- **⚡ Speed** — reach the tap target before the bar empties. Easy cards are a
  one-pad mash; harder ones split into two pads you must alternate, so drumming
  a single finger gets you nowhere. Hitting the target early ends it on a
  PERFECT.
- **🧠 Control** — hold your finger inside a drifting ring, which is what
  starts the card. What counts is the share of the window you stayed inside, so
  slipping out costs you continuously rather than all at once.
  `control.test.ts` pins the drift speed and ring size to a band a finger can
  actually follow, and checks that a varied path is a genuinely different one
  rather than the same curve started later.

## Layout

```
src/
  engine/     pure TS, no React and no clock reads — the whole game is a reducer
    types.ts       state, actions, events
    balance.ts     every tunable number lives here
    cards.ts       the 15 gestures: five of each kind, three NORMAL and two HARD
    simulate.ts    plays whole matches between skill profiles, headless
    recap.ts       turns a finished match into its story
    stats.ts       a finished match as plain numbers, for objectives to read
    characters.ts  the 4 fighters (and the brief for their F4 models)
    accessories.ts the wardrobe: nine slots, six items
    scoring.ts     freshness, aura, momentum
    match.ts       the turn state machine
    cpu.ts         chooseCard and judgeQte, from weights
    rivals.ts      the 6 of them, as data
    objectives.ts  what a rival asks, answered from stats alone
    rewards.ts     what it pays
  audio/      a synthesiser: every sound is oscillators and noise, no files
    uiSounds.ts    what a tap on each part of the interface sounds like
  i18n/       every string the game says, one file per language
  state/      zustand store, setup flow, and the rAF clock driving the reducer
    useProgress.ts   the only thing that survives closing the tab
    useCpuTurn.ts    plays the rival's turns through the same reducer
  scene/      the react-three-fiber stage
    pose.ts        a whole body in fifteen numbers, and how to blend two
    builds.ts      what each fighter is assembled from
    animations.ts  one gesture per card, plus idle, wind-up and reactions
    stageState.ts  reads the match, says who is out front and what they do
    Motes.tsx      the aura you can see: bursts, and a stream under god aura
    StageShell.tsx canvas, air, floor and glow — shared by every screen
    Showcase.tsx   the same fighters, warming up behind the menus
  ui/         DOM overlay: home, setup, handoff, hand, aura bar, judgements
    labels.ts      the engine's data put into the reader's own words
    qte/           one widget per QTE kind, plus the pure maths behind each
    home/          the hub, and the sheet that picks a mode
    solo/          the rival carousel and its objectives
    collection/    what you own and the deck you take in
    settings/      four rows
```

Three rules keep the feel honest:

1. **The engine never reads the clock.** Every action carries `now`, so a whole
   match replays deterministically from its seed and the tests use fake time.
2. **Nothing that ticks goes through React state.** The countdown and the QTE
   cursor write straight to the DOM in their own rAF loop, and taps are judged
   from the pointer event's own timestamp — not from the frame that follows it.
3. **Nothing starts without the player.** The handoff waits for a tap, and so
   does every QTE. Deadlines only run while somebody is actually holding the
   phone.
4. **The handoff has no clock.** It waits for a human, and it deliberately does
   not show the rival's last move: the seconds of pressure start when you are
   already holding the phone.

## The stage

Nobody downloads a model. Each fighter is assembled from primitives at their
own proportions — BLOCKY really is a wide box with stubby limbs, NOODLE really
is tall, thin and floppy — and every gesture is a function of time over those
fifteen pose numbers. That means a move can be tested without a renderer:
`animations.test.ts` checks all ten cards have a body to go with them, that no
pose folds a fighter into a shape it could not hold, that each one rises out of
standing and returns to it, and that a celebration goes up while a MISS goes
down.

Whoever is up steps forward and performs; the other waits upstage — separated
by depth rather than side by side, because a phone held upright sees a tall,
narrow slice of the world. The camera leans in for the performance and flinches
on the judgement. `stageState.ts` decides all of that from the match state
alone, so the staging is testable too.

**The fighters are not only in the battle.** Two of them warm up behind the
title, cycling gestures at random, and the deck builder keeps the one you
picked on a sticky shelf that performs whichever card you tap — so you find out
what Griddy Drop looks like before you take it into a fight rather than during
one. Both use the same shell, models and animations as the battle; only the
camera and who is standing there change. three.js is lazy on every screen, so
the title still paints in 71 kB and the fighters arrive a moment later.

**The scene is the screen, not a window in it.** The canvas fills the match
screen and the interface floats over it in three layers: a status bar at the
top (aura, whose turn, both decks, both momentums), the judgement in the
middle, and a console at the bottom holding everything the thumbs touch — the
hand while choosing, the QTE controls while performing. Nothing a player taps
sits over the performance.

Three rules for anyone adding to the scene:

- **Position and animation never share an element.** The QTE ring learned this
  the hard way: a `transform` keyframe on the element that a rAF loop
  positions will drag it across the pad. Wrapper owns the transform, child
  owns the look.
- **Status goes in the top bar, actions in the console.** A tall QTE grows the
  console upward; anything parked on top of it ends up over the fighter.
- **Fighters open on their mark.** Their slot is seeded at mount rather than
  eased into from the origin, or both of them start the match standing in the
  same spot.

## Juice

The reducer already emitted events nobody was listening to; `useGameEvents`
drains that bus, and everything loud hangs off it.

- **Sound** is synthesised on the spot — oscillators, a noise buffer and an
  envelope. Nothing is downloaded and nothing is licensed. The bank in
  `audio/sounds.ts` is plain data, so it can be tuned and tested without an
  audio context. Getting a phone to actually make the noise takes three
  separate things: the first gesture of any kind opens the context, a sample of
  silence is played inside that gesture so iOS really opens the tap, and
  `navigator.audioSession` is set to `playback` so an iPhone with its ringer
  switch flipped is not silent. Every tap outside a battle makes a noise too:
  one delegated listener and one table in `uiSounds.ts`, rather than a `play()`
  wired into each of several dozen handlers and forgotten in one of them. The
  loop sits on its own fader under the
  master, so MUSIC and SFX in Settings are two switches rather than one, and
  both of them are in the pause menu as well — mid-battle is when somebody
  actually reaches for them. Nothing waits for a tap that the browser did not
  ask for: the context is opened on load and again on the first gesture,
  because a page that is allowed to make noise should not sit silent until
  something is clicked.
- **Motes** burst on a judgement in its own colour and stream upward for as
  long as GOD AURA holds. One fixed pool, additive blending, no allocation
  mid-battle.
- **GOD AURA** is carried by bloom. The composer stays mounted and rides its
  intensity up and down rather than being switched on, so entering the state
  never costs a shader compile in the middle of a turn — and the fighter turns
  emissive, so bloom has something real to catch.
- **The camera** is knocked hardest on the frame a judgement lands and settles
  a third of a second later, harder for a PERFECT than for a GOOD.
- **The rival answers.** Whoever is not performing shrinks away from a PERFECT
  and leans in to enjoy a fumble — and when it is all over the winner jumps
  while the loser folds over, both of them behind a result screen that is a
  gradient rather than a curtain.

## Balance, measured

The numbers were guesses until something played thousands of matches with them.
`simulate.ts` drives the real reducer with profiles — how often a player hits a
PERFECT, whether they bother reading the rival, how often they freeze — and
`balance.test.ts` asserts the shape of what comes out. It found three things
that no amount of playing by hand would have:

- **Whoever moved second was winning 53% of mirror matches.** The opening play
  had nothing to compare against and scored NEUTRAL, so the player who went
  first was taxed for going first. The opening move is FRESH now, and a mirror
  sits at 49.5 / 48.9.
- **MOGGED never happened.** At a threshold of 85 it fired in 0.9% of matches
  even when one player was winning 95% of them. At 58 it ends half of blowouts
  and one close match in twelve — a mercy rule, which is what it was for.
- **Reading the rival barely mattered.** A player who never looked at what was
  just played won 50% of the time against one who always did, because with
  three kinds and four cards a random pick lands FRESH about 60% of the time
  anyway. Widening the multipliers took that to 60/38, but the honest note is
  that FRESH is still mostly free: the mechanic is worth points, not decisions.

The thresholds in `balance.test.ts` are the measured values with headroom, so a
future tweak that quietly flattens the game fails a test instead of shipping.

## Roadmap

- [x] **F0** Vite + React + TS scaffold, portrait viewport
- [x] **F1** Engine: turns, finite decks, freshness, scoring, momentum, endings
- [x] **F2** Playable UI: title settings, setup, handoff, hand, judgements, timing QTE
- [x] **F3** All three QTEs for real, plus a dev range to tune them
- [x] **F4** react-three-fiber scene: stage, the 4 procedural fighters, camera
- [x] **F5** Juice: particles, shake, post-FX, GOD AURA mode, SFX
- [x] **F6** Results recap, and a balance pass driven by simulation
- [x] **F7** Solo: six rivals as data, a measured ladder, objectives and
      rewards, persistent progress, and the hub the modes hang off
- [ ] **F8** Customize: the wardrobe screen behind the slots the rivals already
      wear, and a shop for the coins to go into
