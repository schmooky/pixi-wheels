# Architecture Decision Records

One decision per file: context, decision, consequences. Read in order the first time.

| # | Title | Status |
|---|---|---|
| [001](./001-builder-and-config.md) | Fluent builder with a serialisable config twin | Accepted |
| [002](./002-planned-stop.md) | The stop is planned as legs from the cruise speed, not tweened | Accepted (load-bearing) |
| [003](./003-angles-and-pointer.md) | Degrees, clockwise positive, wheel-local; the pointer reads decreasing local angles | Accepted (load-bearing) |
| [004](./004-scope.md) | Scope: what pixi-wheels is and is not | Accepted (load-bearing) |
| [005](./005-anticipation-as-geometry.md) | Anticipation is planned geometry and never moves the landing | Accepted |
| [006](./006-dynamic-sections-are-cosmetic.md) | Dynamic sections change weights, never outcomes | Accepted |
| [007](./007-skins-own-pixels.md) | Skins own pixels; rings own motion | Accepted |
| [008](./008-headless-testing.md) | Deterministic testing on a fake ticker | Accepted |

## Writing a new ADR

Copy a file, number it, keep it under 800 words, link it here. ADRs need no changeset.
