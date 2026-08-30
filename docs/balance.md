# Balance

Every tunable number is in `src/engine/balance.ts`. Nothing else should hold a
magic constant. The tests in `balance.test.ts` and `rivals.test.ts` assert the
*measured* values with headroom, so a change that quietly flattens the game
fails a test instead of shipping.

## The loop

```bash
npm run measure     # before
# change one number
npm run measure     # after — compare
npm test            # the guards
```

`npm run measure` prints three tables: the rival ladder, every card in three
pairs of hands, and what a match looks like. Read the card table for **spread**:
a tier should tell three hands apart. A card returning the same grade to sloppy
and solid alike has stopped discriminating, which is a bug even when every test
passes.

## What the simulation cannot see

**`oddsFor()` in `cpu.ts` scores a card from `card.difficulty` and nothing
else.** Not `perfectMs`, not `goodMs`, not `zones`, not `zoneRadius`, not
`laneWidth`, not `sweepMs`.

So:

- Widening a window, moving a zone, growing a ring or slackening a lane changes
  what a human feels and **moves nothing** in `npm run measure`. Do not sweep
  those values against the simulation; you will be tuning against a constant.
- What *does* move the numbers: `difficulty`, `goodAt`, anything feeding
  `chancesIn()`, card `durationMs`, and the constants below.
- Judge geometry by playing it in the dev range (`?qte=<card-id>`), and judge
  counts and thresholds by measuring.

The same blindness means the simulation cannot know that a steady rhythm is
learnable. It models each beat as an independent roll, so a card whose
difficulty lives in a beat you can lock into (`lanes`, a busy `sweep`) will
measure harder than it plays.

## The knobs

### What a run is worth

| Knob | Moves | Guarded by |
|---|---|---|
| `QTE_SCRAPPY_VALUE` | what a scraped chance is worth vs a clean one | parity between the two-tier and one-tier games |
| `QTE_MISTAKE_COST` | how far one fumble drags a run back | "cancels exactly one clean beat per fumble" |
| `QTE_BAR_SHARE` | the bar as a share of chances, for `mash` and `order` | the per-tier spread |
| `QTE_OPEN_HEADROOM` | fewest chances past the bar an open gesture holds | "room to slip" |
| `QTE_HOLD_CLEAN` | share of a stretch that counts as held | `tickBeat` tests |
| `QTE_RAMP` | how much harder a card gets as it runs — **1, deliberately** | "asks the same thing on its last chance as on its first" |
| `CONTINUOUS_BAR` (`qte.ts`) | the bar for `zone` and `paths`, per tier | the per-tier spread |

### What a play scores

| Knob | Moves |
|---|---|
| `PERFECT_BONUS` | flat bonus on a flawless run |
| `MISS_PENALTY` | what a MISS costs |
| `FRESH_AURA` | answering with a different kind |
| `HARD_AURA` | the tier premium — **the steepest lever in the game** |
| `STREAK_AURA_*` | consecutive PERFECTs |
| `GOD_AURA_MULT` | the multiplier at full momentum |

`HARD_AURA[3]` deserves its warning. The default deck is the EASY card of every
gesture; the last rival plays nothing but HARD. Set the premium too high and the
tiers stop being a choice and become an obligation, and the ladder becomes
unbeatable with a starting deck. It has been as high as 1800 and that was much
too high.

### Momentum, and god aura

| Knob | Moves |
|---|---|
| `MOMENTUM_MAX` | god aura fires here (100) |
| `MOMENTUM_JUDGE` / `_FRESH` / `_HARD` / `_STREAK_*` | the four ways up |
| `OUTAURA_RATIO` | how far you must out-score the rival to out-aura them |
| `OUTAURA_MOMENTUM` | what out-auraing pays — 25, a quarter of the bar |
| `GOD_AURA_BREAK` | what a MISS knocks off it |

### The rivals

| Knob | Moves |
|---|---|
| `rival.strategy.qteSkill` | the main dial on a rival's difficulty |
| `PERFECT_SCALE` / `MISS_SCALE` | how tiers scale a rival's odds |
| `CPU_PACE_FLOOR` / `_SPAN` | how far up from the bar toward the ceiling a rival plays |
| `CPU_SLIP_SCALE` | fumble rate on the games with a lesser target |
| `QTE_FORM_SWING` | per-card luck, drawn once and felt on every beat |

`qteSkill` is not a linear dial — a rival's deck and strategy weights matter as
much. The Mewer needed 0.83 to sit where the Rookie sits at 0.62.

### The match

| Knob | Moves |
|---|---|
| `MOGGED_THRESHOLD` | the mercy rule. Retune it whenever play scores move. |
| `SOLO_DECK_SIZE` | the solo hand (6). Rival decks must match. |
| `BAR_CURVE` | how the shared aura bar maps score to position |

## Things that are true and were expensive to find out

- **A bar at half of many chances is trivially cleared while a flawless run at
  many chances is impossible.** Both ends of the range get squeezed and every
  run comes back GOOD. If a card stops discriminating, look at its chance count
  before anything else.
- **`clean === taken` counts every beat the player produced**, so on a gesture
  that invites over-tapping, trying more can only hurt. Widgets that offer more
  chances than the card counts must throttle — see the sweep's one-answer-per-trip.
- **Momentum and MOGGED are coupled.** God aura doubles what a play is worth, so
  faster momentum feeds the aura bar and brings MOGGED forward with it. They
  cannot be tuned independently.
- **The default deck feeds the ladder.** `defaultDeck()` in `useProgress.ts`
  decides what a new player brings to every rival, so changing it moves every
  win rate in `npm run measure`.
