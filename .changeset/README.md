# Changesets

This folder drives releases of `pixi-wheels`. Changesets reads the `.md` files here, decides the version bump, generates `CHANGELOG.md`, and publishes to npm.

| Action | Command |
|---|---|
| Add a changeset (in your PR) | `pnpm changeset` |
| See what would be released | `pnpm changeset:status` |
| Apply pending changesets (CI does this) | `pnpm version-packages` |
| Publish (CI does this) | `pnpm release` |

## Writing one

1. `pnpm changeset`, pick `pixi-wheels`, pick the bump: `patch` for fixes, `minor` for additive features, `major` for breaking changes (pre-1.0 included).
2. Write one past-tense line for a consumer reading the changelog. Lead with the verb: `Add: stutter anticipation style.` `Fix: pointer:tick fired twice on a divider the spin started on.`
3. Commit the generated file with your PR.

`@pixi-wheels/site` is private and ignored.

## Commit types to bumps

| Commit | Bump |
|---|---|
| `feat:` | minor |
| `fix:`, `perf:`, `refactor:` (user-visible) | patch |
| `docs:`, `test:`, `build:`, `ci:`, `chore:` | none (use the `skip-changeset` label) |
| `!` or `BREAKING CHANGE:` | major |

## After merge

The publish workflow opens a "Version Packages" PR when changesets are pending; merging it publishes with npm OIDC trusted publishing. Every other branch publishes a snapshot under its own dist-tag.
