# The six minigames

Three *kinds* (what the card is filed under, and what freshness is measured on)
holding two *games* each (the thing your thumb actually does):

| Kind | Game | What you do |
|---|---|---|
| 🎯 Timing | `sweep` | A cursor crosses the bar; hit it inside a green zone. |
| 🎯 Timing | `lanes` | Notes fall down lanes; hit each one on the line. |
| ⚡ Speed | `mash` | Tap pads as fast as you can, in order when there is more than one. |
| ⚡ Speed | `order` | Numbers scattered on a pad; press them 1, 2, 3… |
| 🧠 Control | `zone` | Keep a finger inside a drifting ring. |
| 🧠 Control | `paths` | Keep a finger inside a lane that scrolls and wanders. |

Eighteen cards: one per game per tier. `difficulty` 1 / 2 / 3 is EASY / NORMAL /
HARD. The twelve EASY and NORMAL cards are starters; the six HARD ones are what
the six rivals hand over.

## Difficulty is what the card asks for, never how fast it goes

Every gesture runs at one pace across all three tiers, and `QTE_RAMP` is 1 so a
card does not tighten as it runs either. A card that was narrower *and* quicker
*and* accelerating was doing the difficulty three times, and the same input
being worth less the longer you kept it up reads as the game moving the target.

| Game | EASY → HARD |
|---|---|
| `sweep` | 1 → 2 → 3 green zones, and narrower windows |
| `lanes` | quarters → eighths → sixteenths (`subdivisions` 1 / 2 / 4) |
| `mash` | 1 → 2 → 3 pads (one mashed, two alternated, three walked L·M·R·M·L) |
| `order` | 5 → 6 → 7 numbers on the pad |
| `zone` | a big ring → a medium one → a small one |
| `paths` | a wide lane → a medium one → a narrow one |

## How a run is graded

One vocabulary for all six. A gesture offers **chances**; you answer them with
**beats**; the beats accumulate into a **ledger**; `settle` reads the ledger.

```
chancesIn(card)     what the card holds — every chance it will ever offer
opportunities(card) the bar: how much of that you must land to score at all
```

A beat is one of three things:

- **clean** — you took the chance well.
- **scrappy** — you took the lesser target. Only `sweep` and `lanes` have one
  (the amber band, a note caught off the beat); see `scrapeable()`. Worth
  `QTE_SCRAPPY_VALUE` of a clean beat, which is nearly all of it — the cost of a
  scrape is the flawless run, not the points.
- **missed** — you did not take it. Costs a whole chance
  (`QTE_MISTAKE_COST`), so enough of them drag a run that had cleared the bar
  back under it.

Then:

```
cleared  = value − mistakes ≥ bar
flawless = every beat clean AND every chance the card held was answered
accuracy = value ÷ chancesIn      (0…1)

MISS     = not cleared            score 0
GOOD     = cleared                score = baseAura × accuracy
PERFECT  = cleared and flawless   score = baseAura × accuracy  (+ PERFECT_BONUS)
```

**PERFECT is not a higher count than GOOD, it is a clean one.** Two rules make
it, both deliberate:

1. Scrape anything and it is gone. Landing in the amber scores, and it also
   ends any claim on a flawless run.
2. Clear the bar and stop and it is gone. The card was still offering chances
   and you did not take them — otherwise "do the nine and put the phone down"
   would be the best way to play an open gesture.

### Counted versus open

`pacingOf(card)` says which:

- **Counted** (`lanes`, `zone`, `paths`) — the chances come to you whether you
  answer them or not. A note that goes past is charged as a mistake by
  `ignored()`, and on `lanes` so is a tap into a lane with nothing in it: a
  swing at nothing that cost nothing made drumming on all three lanes strictly
  better than reading the chart. `EMPTY_GUARD_MS` keeps one hand across three
  lanes to one mistake rather than three.
- **Open** (`sweep`, `mash`, `order`) — you take as many as your hands manage.
  Falling short simply scores less; there is nothing to charge you for.

### The sweep counts trips through a zone

A pass of the bar meets every zone on it, so `crossings()` counts zone trips,
not traverses. Zones sit in the middle of `zones` equal slices, which is the one
arrangement giving a constant beat — every `sweepMs / zones`, out and back
alike.

**A trip has its zone in the middle of it**, with a boundary either side at the
two points furthest from any zone (`zoneTripAt` floors; rounding would put the
boundary *on* the zone). This is what keeps the drawn zone and the scored chance
the same window: approaching a zone and leaving it are one chance, so a tap
anywhere a player can see green is the chance they think it is.

The bar **opens at an end**, which is the furthest point from any zone and so
both the longest run-up the card's rhythm allows (`sweepMs / (2 × zones)`) and
the only start not sitting on a target. The tap that arms a sweep is never
graded, so it must not land on something scorable.

A second tap inside the same trip is the same chance twice and is dropped
rather than charged, so drumming on a busy bar cannot fumble chances that were
never offered — but it still gets a pulse, because a tap that changes nothing
on screen is indistinguishable from one the phone missed.

Both ways of starting — the first touch, and the automatic start after
`QTE_ARM_MS` — go through one `begin()`, so they produce identical state.

## One drawing of each board

`boards.tsx` holds the six boards as presentational components — the bar and its
zones, the lanes, the pads, the number pad, the ring, the track and its wheels —
and `boardPaint.ts` holds the one `paint` per board that positions whatever
moves, from the same pure geometry the card is graded on.

The widget wraps a board and grades what happens on it. **The tutorial wraps the
same board** and moves a scripted hand over it, on a clock of its own because
the game's is deliberately stopped behind it. Neither draws its own version.

That is not tidiness, it is the fix for a real bug. The tutorial used to draw
each minigame again in CSS keyframes, and the drawings drifted: the drive-test
one ended up showing two upright bars with a finger in each, which is not a
gesture this game has — the thumbs never touch the lanes, they sit on the wheels
below and steer. `boards.test.ts` fails if a board's class names appear anywhere
but `boards.tsx`.

The hand is placed from `getBoundingClientRect()` of the target the geometry
returned, never from a tuned offset. Move a zone, widen a lane, rescatter the
numbers, and the finger follows without anybody adjusting a keyframe.

## Every widget follows the same shape

```
useArming(startedAt)   nothing starts until a touch; arms itself after QTE_ARM_MS
useRun(card, onResult) the ledger, the paint hook, and finish()
<QteMeter run unit />  the bar, the run past it, and whether flawless is still on
```

`run.paint(root)` writes progress to the DOM inside the widget's own rAF loop —
none of it goes through React state. Taps are graded from
`event.nativeEvent.timeStamp`, not from the frame that follows, because that
difference is a whole judgement grade.

The meter is green while a flawless run is still possible and amber once it is
not, which is the only place a player is told a scrape cost them something.

## The first time each one comes up

The battle stops and explains the gesture: an animated hand doing it, one line
of text, and a button to put it away. One tutorial per *minigame*, not per card
— a sweep and a chart are both Timing and have nothing in common, so what needs
explaining is never the tier.

It takes **its own hold on the game clock** (`showTutorial` / `dismissTutorial`
in the store) rather than reusing `paused`, which is the pause *menu* and would
render behind it. Both stop the same clock, and it stays stopped while either
wants it stopped. That hold is the whole safety of the feature: `now()` freezes,
so the QTE's own `endsAt` is not running behind the explanation and nobody loses
a card to reading one.

Seen flags live in `useProgress`, so they survive closing the tab, and they are
per device rather than per player — a hot-seat guest gets whatever the phone was
already taught. Settings has a button to hand them all back.

## The dev range

`?qte` opens a range where one card's QTE repeats as many times as it takes to
tune it. `?qte=griddy-drop` starts on that card; the chips switch between all
eighteen. `window.__game` is the live store and `window.__audio` is the synth.
