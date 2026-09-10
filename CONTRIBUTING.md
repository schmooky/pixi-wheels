# Contributing

Thanks for your interest in pixi-wheels. This file covers the mechanics; [AGENTS.md](./AGENTS.md) has the house style and the constraints the lint guards enforce.

## Quick start

```bash
git clone https://github.com/igaming-bulochka/pixi-wheels.git
cd pixi-wheels
pnpm install
pnpm --filter pixi-wheels test
pnpm site:dev                     # docs site at http://localhost:4321
```

Node 22+ and pnpm are required.

## Workflow

1. Branch from `main` with a human name like `feat/stutter-style` or `fix/pointer-tick-order`.
2. One logical change per PR.
3. `pnpm test` (lint guards + vitest) must pass.
4. If the change is user-visible in the published package, add a changeset: `pnpm changeset`.
5. Open a PR. The template asks for a summary, a test plan and the changeset.

## Good looks like

- Small, readable diffs. No drive-by refactors.
- Comments explain why.
- ASCII punctuation in source, commit messages and UI strings.
- No default exports. `.js` extensions in imports.
- Behaviour-named tests.

## Commits

Conventional Commits, linted on commit: `feat(spin): ...`, `fix(pointer): ...`, `docs: ...`. See `commitlint.config.cjs`.

## Releases

Changesets version and publish on merge to `main` via npm trusted publishing. Every other branch publishes a snapshot under its own dist-tag. See `.changeset/README.md`.

## Studio art

The Playson and Pragmatic Play assets under `apps/site/public/` are used with the studios' permission for this site only. Do not add third-party game art without written permission recorded in the PR.
