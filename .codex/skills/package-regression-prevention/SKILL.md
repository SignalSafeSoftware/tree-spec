---
name: package-regression-prevention
description: "Prevent contract, packaging and verification regressions when changing a published SignalSafe ecosystem package: public API, dependency ranges, exports, CSS class contracts and release metadata. Use for any change that is not documentation-only."
metadata:
  short-description: "Guard published package contracts"
---

# Package regression prevention

Published packages are consumed by hosts that cannot be fixed in the same commit, so contract changes need evidence.

## Required workflow

1. Read the package `AGENTS.md`, then identify the boundary changed: public exports, props and slots, wire contract, class names or CSS, dependency ranges, build output, or release metadata.
2. Inspect the existing focused tests and the public surface (`src/index.ts`, `exports` in `package.json`, README props) before editing.
3. Add or update a test for each behavior or invariant that could return. Default behavior must keep passing unchanged tests; if an existing test must change, say why in the final report.
4. Keep strictness: no new type, lint or coverage suppressions, no lowered coverage thresholds, no re-exports or compatibility aliases, no new runtime dependencies without approval.
5. Run the package gates from its `AGENTS.md` (typecheck, tests with coverage, `smoke:package`, `publish:dry-run` when metadata changes). For cross-package changes, pack the upstream package and verify the downstream one against that tarball before claiming compatibility.
6. Confirm no nested duplicate `@signalsafe/*` installs result from the change (see `ecosystem-release`).
7. Run `git diff --check`, review the diff for scope creep, and report only commands that actually passed. Report gates that could not run (for example `smoke:package` waiting on an unpublished dependency) as not run.

## Enforcement boundary

This skill guides behavior; CI and package tests are the authority. If a needed guard does not exist, add it with a test instead of relying on this skill.
