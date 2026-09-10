---
"pixi-wheels": minor
---

Anticipation reworked around the "it was going to be the jackpot" beat.

- Every tease now rests the pointer just inside the target, next to the divider it shares with the bait (`rest`, default 0.22 of the target's arc). `rest: 'keep'` leaves the landing mode in charge; explicit offsets, angle / position targets and `mode: 'exact'` are never moved. Add `settle: 'center'` to glide to the middle afterwards.
- `overshoot` goes only slightly over the line: a fifth of the bait's arc, at most 5 degrees (was 6 fixed), holds a beat (`dwellMs` default 180, was 700) and rolls back on a `power2.inOut` curve whose length scales with the distance (`returnMs` default 350 + 40 per degree, 450..1200) instead of a fixed 800 ms snap.
- `stutter` halts 5 degrees short of the line (was 8) and nudges over in 700 ms (was 900).
- New exports `DEFAULT_ANTICIPATION`, `defaultOvershootDeg`, `defaultReturnMs`.
