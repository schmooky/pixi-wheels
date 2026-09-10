# ADR 001: Fluent builder with a serialisable config twin

## Status: Accepted

## Context

A wheel is a dozen decisions: radii, sections, pointers, skin, speeds, landing rules, skip rules, idle, rings. Wiring them by hand in every game means every game wires them a little differently. Studios also want to hand a designer a tool that produces the wheel without writing code, and a game wants to load that output.

## Decision

`WheelBuilder` is the one way to construct a `Wheel`. It validates on `build()` and throws a message that names the fix. Every builder method has a JSON counterpart in `WheelConfig`: `builder.toConfig()` and `WheelBuilder.fromConfig(cfg, { assets })` round-trip. Skins and pointer skins are accepted as instances (for code) or as `{ type, ...options }` configs resolved through a registry (for JSON). Asset references in configs are string keys resolved by an `AssetResolver`.

## Consequences

- One construction path; the studio, the recipes and a game all produce the same object.
- Configs are the studio's export format and the template format (`WheelTemplates`).
- A skin given as an instance cannot be serialised; `toConfig()` records `{ type: 'custom' }` with a warning rather than failing.
- Validation is centralised in `build()`, so a bad ease or a missing ticker fails before the first frame.
