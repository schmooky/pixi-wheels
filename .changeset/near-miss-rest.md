---
"pixi-wheels": minor
---

Anticipation reworked so the wheel comes to rest exactly once, on the result.

- Every tease rests the pointer just inside the target, next to the divider it shares with the bait (`rest`: 0.22 of the arc after crossing the line, 0.15 when it died short of it). `rest: 'keep'` leaves the landing mode in charge; explicit offsets, angle / position targets and `mode: 'exact'` are never moved. Add `settle: 'center'` to glide to the middle afterwards.
- New style `stall` replaces `overshoot`: the pointer enters the result, crawls toward the bait's line as if it will cross, and dies just short of it. No stop inside the bait, no roll back. `auto` picks it when the bait follows the target.
- `stutter` no longer halts: the crawl slows to `hesitateSpeed` (2 deg/s) for `dwellMs` (600) a hair short of the line, then slips over it in `pushMs` (700) on a curve that takes over at the crawl speed.
- Removed `overshootDeg` and `returnMs`; added `hesitateSpeed` and `approachDeg` (stall crawl length, default the target's arc, at most 45). New leg kind `hesitate`; `return` is gone. New exports `DEFAULT_ANTICIPATION` and `hermiteStopEase`.
