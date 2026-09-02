# Aura Battle

Hot-seat aura-farming duel. Two players on one phone, or one up a ladder of six
rivals. React 19 + TypeScript + Vite, zustand for state, react-three-fiber for
the stage. No backend, no assets — every sound is synthesised and every fighter
is built from primitives at runtime.

## Commands

```bash
npm run dev       # vite, portrait-first — open on a phone from the Network: address
npm test          # 612 tests, ~3s
npm run build     # tsc -b && vite build
npm run lint      # eslint
npm run measure   # the whole game's numbers, printed — read docs/balance.md first
npm run balance   # the balance test's own tables
```

Before any commit: `npm test && npm run lint && npm run build`. All three are
fast; there is no reason to skip one.

## Where things are

- `src/engine/` — pure TypeScript, no React and no clock reads. The whole game
  is a reducer. `balance.ts` holds every tunable number.
- `src/ui/qte/` — one widget per minigame, plus the pure maths behind each in a
  sibling module (`timing.ts`, `lanes.ts`, `speed.ts`, `control.ts`, `paths.ts`).
  The boards themselves live once, in `boards.tsx` / `boardPaint.ts`: the card
  and its tutorial render the same components from the same geometry, so a
  change to one cannot leave the other showing a gesture the game does not have.
- `src/scene/` — the react-three-fiber stage. A pose is fifteen numbers.
  `firetoy/` is the imported character pack: a catalogue of 310 wardrobe pieces
  keyed by GLB node name, the twenty original presets, `cast.ts` for who wears
  what, and one component that wears them. `?firetoy` opens the range. The
  battle is Firetoy characters, and so is the title — behind a light HTML
  splash that waits for the male body and nothing else.
- `src/state/` — zustand store, the rAF clock, and the only thing that survives
  closing the tab (`useProgress.ts`).
- `docs/qte.md` — the six minigames, their parameters and how a run is graded.
- `docs/balance.md` — every knob, what it moves, and which test guards it.
- `docs/firetoy.md` — the character pack: how an outfit is represented, the two
  rules it really has, and where the loader disagrees with the asset map.

## Invariants

1. **The engine never reads the clock.** Every action carries `now`, so a match
   replays exactly from its seed. Tests use fake time.
2. **Nothing that ticks goes through React state.** Countdowns and QTE cursors
   write to the DOM from their own rAF loop; taps are judged from the pointer
   event's own timestamp, not the frame after it.
3. **Nothing starts without the player.** Every QTE arms on first touch.
4. **Randomness comes from the match seed**, never `Math.random()`.

## Before changing a number in `balance.ts`

Run `npm run measure`, make the change, run it again, and compare. The balance
tests assert measured values with headroom — a change that quietly flattens the
game fails a test instead of shipping.

**The one thing that will waste your time:** the simulated rivals score a card
from `card.difficulty` alone (`oddsFor` in `cpu.ts`). Millisecond windows, zone
counts, ring sizes and lane widths are invisible to them. Changing `perfectMs`
moves what a human feels and nothing the simulation reports. See
`docs/balance.md#what-the-simulation-cannot-see`.

## Style

Match the surrounding code: comments explain *why*, in prose, and say what went
wrong before if that is what the code is defending against. Commit messages are
written the same way — what changed, and what it was like before.
