---
name: ecosystem-release
description: "Plan and prepare a release of a SignalSafe ecosystem package (tree-spec, tree-spec-editor-core, tree-spec-editor-react, tree-spec-editor, tree-spec-editor-theme-bootstrap, tree-spec-learner-react, tree-spec-python): version choice, dependency ranges, release order, changelog, gates, and host upgrade steps. Use before bumping a version or changing an @signalsafe dependency range."
metadata:
  short-description: "Release SignalSafe packages without duplicate installs"
---

# Ecosystem release

## Why this exists

Dependency ranges on 0.x versions are narrow: `^0.3.4` resolves only `>=0.3.4 <0.4.0`. A dependent that lags one minor installs a second nested copy of the dependency in every consumer, which duplicates code and splits types and constants. Plan versions and ranges together.

## Workflow

1. List what changed per package and whether it is additive, fixing, or breaking. Prefer patch bumps for compatible changes so existing `^0.x.y` ranges still resolve; use a minor bump only for a deliberate break or a feature that dependents must require.
2. Build the dependency graph and release in this order, updating each dependent's range to the version just released:
   `tree-spec` -> `tree-spec-editor-core` -> `tree-spec-editor-react` -> `tree-spec-editor` (+ `tree-spec-editor-theme-bootstrap`) -> `tree-spec-learner-react` -> hosts. `tree-spec-python` releases independently and is pinned by hosts.
3. Per package: bump `version` (`VERSION` for Python), move `CHANGELOG.md` `[Unreleased]` into a dated section, update version-pinned tests (`tests/package-metadata.test.ts`), README or docs that name versions or props.
4. Run the package gates from its `AGENTS.md`. `smoke:package` installs published dependencies, so it passes only once the previous package in the order is published; verify earlier by packing the upstream package (`npm pack`) and installing the tarball into `node_modules` without editing `package.json`.
5. Check for nested duplicates after installing in each package and in hosts: `find node_modules -path '*node_modules/@signalsafe/*' -name package.json -not -path '*/dist/*'` should list one copy per package; `yarn.lock` should hold one entry per `@signalsafe/*` name.
6. Publishing happens from the package repository by pushing a `v*` tag on `main` after CI passes (see `RELEASING.md`). Do not tag, push, or publish without explicit user approval.

## Host upgrade checklist (after publishing)

- Bump every `@signalsafe/*` range in the host together, reinstall, and re-run the host's typecheck, lint, tests and e2e.
- Remove host shims that the release made redundant and note them in the release plan (for example Adventure Stories' `treeSpecNullNormalization` and `treeSpecIssueAnchors` once `@signalsafe/tree-spec` >= 0.4.2 is installed; its `collapsibleChoices` CSS workaround once `@signalsafe/tree-spec-editor` >= 0.4.0 and the theme >= 0.3.4 are installed).
- Do not bump simulator packages as part of a TreeSpec upgrade; they follow their own prerelease and migration notes.
