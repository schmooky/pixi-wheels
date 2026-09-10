# ADR 002: The stop is planned as legs from the cruise speed, not tweened

## Status: Accepted (load-bearing)

## Context

The obvious implementation tweens `rotation` to a target angle with an ease-out when the result arrives. It has three problems. The tween's initial speed has nothing to do with the cruise speed, so the hand-off is a visible jerk. Anticipation (slow near the jackpot, then creep) needs several pieces with different shapes. And a tween library runs on its own clock, which makes deterministic tests and hidden-tab behaviour a fight.

## Decision

`StopPlanner` is a pure function from `(rotation, speed, direction, landingRotation, profile, anticipation)` to a list of legs, each a distance, a duration, an ease and a direction. The first leg's ease has its initial slope matched to the cruise speed: `duration = distance * slope / speed`. Because that fixes the duration for a given distance, the planner chooses the number of full turns whose duration is closest to the profile's `stopDuration` within `[minTurns, maxTurns]`. Anticipation, skip and settle are more legs of the same kind. `SpinController` plays legs off the ticker's `deltaMS`. No tween library; eases are plain functions named after the GSAP vocabulary.

## Consequences

- No velocity step when the result arrives; a skip is a leg replacement, so it is continuous too.
- Everything is a function of `deltaMS`: `FakeTicker` reproduces a spin frame for frame, and hidden tabs cannot desync anything.
- `stopDuration` is a target, not a promise; `spin:stopping` reports the actual duration.
- An `inOut` ease has slope 0 and cannot be matched; the planner clamps and warns once. Profiles use `out` curves.
- The planner is unit-tested on its own; the controller's tests only check ordering and landing.
