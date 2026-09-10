# ADR 005: Anticipation is planned geometry and never moves the landing

## Status: Accepted

## Context

A near-miss is the most valuable beat of a bonus wheel: the pointer heads for the jackpot and does not quite get there. Implementations that improvise it (slow down "near the big one", then find somewhere to land) end up landing where the animation happened to stop, which is a compliance problem, or snapping to the result at the end, which is a visible cheat.

## Decision

Anticipation is resolved when the result arrives, from the geometry: the bait's entry edge, the landing angle and the spin direction. Three styles, each a fixed set of forward legs: `creep` (decelerate to a crawl at the bait's entry, crawl across it and over the line into the landing section), `stutter` (the same crawl, slowing to a near-stall a hair short of the line, then a slip over it), `stall` (decelerate to a crawl at the landing section's entry, crawl toward the bait's line and die just short of it). `'auto'` picks by which side of the landing the bait is on and how far. A bait that is not a neighbour within `maxDistanceDeg` is dropped with a console warning and the wheel lands plainly. A tease never moves the landing off the result; it places it next to the divider the result shares with the bait (`rest`), and the wheel comes to rest exactly once, there.

## Consequences

- The result is the server's, always. The tease is presentation.
- Bait geometry is checked, so a designer learns immediately when a bait cannot read.
- `protectSkip` makes the first skip press jump to the bait rather than past it, so a player who skips still sees the moment.
- Events bracket every beat (`anticipation:start`, `anticipation:bait`, `anticipation:end`) for audio.

## Addendum (2026-09-10)

The `overshoot` style (a stop inside the bait followed by a roll back) was replaced by `stall`, and `stutter` no longer halts inside the bait: every tease is now a single deceleration that comes to rest once, on the result, next to the divider it shares with the bait (`rest`). A stop followed by more motion read as a glitch, whatever the direction of the extra motion.
