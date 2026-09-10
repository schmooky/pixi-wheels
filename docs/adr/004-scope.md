# ADR 004: Scope

## Status: Accepted (load-bearing)

## Decision

`pixi-wheels` owns the visual lifecycle of a wheel: geometry, motion, pointers, skins, and the typed events describing them. It does not decide outcomes, play sound, run bonus state machines, draw HUDs or load assets.

| In scope | Out of scope |
|---|---|
| Builder, config, templates | Odds, RTP, outcome selection (`setResult` is the inbound interface) |
| Spin lifecycle, planned stop, skip, slam | Audio (wire it to events) |
| Landing modes, settle, anticipation | Feature / bonus state machines |
| Dynamic sections, rings, idle | UI, HUD, balance, bet |
| Pointers and flap | Asset pipelines (skins take textures / aliases) |
| Graphics / debug / texture / Spine skins | Analytics, wallet, session |
| Events, debug tools, headless testing | i18n, accessibility (the surrounding DOM) |

The rule of thumb: if it appears in a game design document it belongs to the consumer; if it appears in a wheel widget's changelog it belongs here.

## Consequences

- The main barrel stays small (a few kilobytes gzipped plus the shared chunk); Spine and testing are subpaths.
- Site runtime code (the Playson skin, the Pragmatic loader, the mock server) is reference code, not API.
- Requests from the right column are declined with a pointer to this file.
