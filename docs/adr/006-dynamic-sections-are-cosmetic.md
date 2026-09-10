# ADR 006: Dynamic sections change weights, never outcomes

## Status: Accepted

## Context

Studios ask for wheels whose sectors change size as a round progresses: jackpot sectors that grow with a meter, a gamble's winning half that shrinks. The brief that shaped this library said it plainly: the changes are like "volcano states", purely cosmetic, not to be synchronised with the math.

## Decision

A section's arc is its weight. `Ring.setWeights()` animates weights over a duration with an ease and re-lays out the geometry every frame; skins redraw and labels re-centre. `.dynamic({ steps })` on the builder names weight sets so a game can `setStep(i)` from its feature state. The landing angle of a spin in flight is fixed at `setResult()`; a weight change during the stop does not move it, and the result reports the section decided at `setResult()`.

## Consequences

- Zero coupling to the outcome: the server never needs to know the arcs.
- Labels and decorations follow the middle of their arc for free on the graphics and texture skins.
- Authored art (Spine, atlas plates) is painted for fixed arcs and ignores weight changes; the docs say so.
- Changing weights *while* the pointer sits on a landing can visually move it into a neighbour. That is the game's call; the engine does not police it.
