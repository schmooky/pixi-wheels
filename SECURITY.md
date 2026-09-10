# Security Policy

## Supported versions

Only the latest release of `pixi-wheels` receives security fixes. Snapshot releases are previews with no SLA.

## Reporting a vulnerability

Please do not file a public issue. Open a draft advisory at https://github.com/schmooky/pixi-wheels/security/advisories/new with a description, a reproducer and the version or commit.

## What to expect

Acknowledgement within a few days, an assessment within a week, and coordinated disclosure once a patched release is available.

## Scope

In scope: the published package, the docs site, the CI and release tooling. Out of scope: bugs in PixiJS or the Spine runtime (report upstream), denial of service via pathological inputs (a wheel with ten thousand sections), scanner output without a reproducer.
