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
  `ignored()`.
- **Open** (`sweep`, `mash`, `order`) — you take as many as your hands manage.
  Falling short simply scores less; there is nothing to charge you for.

### The sweep counts trips through a zone

A pass of the bar meets every zone on it, so `crossings()` is
`traverses × zones`. Zones sit in the middle of `zones` equal slices, which is
the one arrangement giving a constant beat — every `sweepMs / zones`, out and
back alike. An odd zone count puts one dead centre, which is where the bar
opens: that trip is already going as the card starts, so it is spent at arming
and counts as neither hit nor fumble.

A second tap inside the same trip is the same chance twice and is dropped
rather than charged, so drumming on a busy bar cannot fumble chances that were
never offered.

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

## The dev range

`?qte` opens a range where one card's QTE repeats as many times as it takes to
tune it. `?qte=griddy-drop` starts on that card; the chips switch between all
eighteen. `window.__game` is the live store and `window.__audio` is the synth.
