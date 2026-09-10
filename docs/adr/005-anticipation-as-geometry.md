# ADR 005: Anticipation is planned geometry and never moves the landing

## Status: Accepted

## Context

A near-miss is the most valuable beat of a bonus wheel: the pointer heads for the jackpot and does not quite get there. Implementations that improvise it (slow down "near the big one", then find somewhere to land) end up landing where the animation happened to stop, which is a compliance problem, or snapping to the result at the end, which is a visible cheat.

## Decision

Anticipation is resolved when the result arrives, from the geometry: the bait's entry edge, the landing angle and the spin direction. Three styles, each a fixed set of legs: `creep` (decelerate to a crawl at the bait's entry, crawl across into the landing), `stutter` (halt inside the bait, dwell, push over the line), `overshoot` (pass the landing into the bait, dwell, roll back). `'auto'` picks by which side of the landing the bait is on and how far. A bait that is not a neighbour within `maxDistanceDeg` is dropped with a console warning and the wheel lands plainly. The landing angle is never changed by a tease.

## Consequences

- The result is the server's, always. The tease is presentation.
- Bait geometry is checked, so a designer learns immediately when a bait cannot read.
- `protectSkip` makes the first skip press jump to the bait rather than past it, so a player who skips still sees the moment.
- Events bracket every beat (`anticipation:start`, `anticipation:bait`, `anticipation:end`) for audio.
