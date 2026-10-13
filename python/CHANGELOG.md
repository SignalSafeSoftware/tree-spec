# Changelog

## Unreleased — repository consolidation

- Own Python and TypeScript in one tree-spec repository.
- Preserve package/import names and wire behavior; publish language-specific archives.
- Verify fixture parity and distribution isolation in CI.


All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

No unreleased changes recorded.

## [0.3.0] - 2026-09-08

### Added

- Stable graph diagnostics for duplicate choice IDs and reachable nodes that
  cannot reach `END`, including diagnostic locations.

### Changed

- Align graph diagnostic codes and locations with the TypeScript TreeSpec
  contract, while retaining the `level` field and exposing equivalent
  `severity` terminology for cross-language consumers.

## [0.2.0] - 2026-08-30

### Added

- Preserve choice-level `render_hints` in Python model round-trips.
- Normalize legacy `options` collections and `__END__` targets to the canonical TypeScript wire shape.
- Add parity tests for legacy normalization and choice presentation hints.

## [0.1.3] - 2026-08-30

### Changed

- Updated CI actions and locked development tooling for the maintained release workflow.

## [0.1.2] - 2026-06-28

### Added

- [docs/compatibility.md](./docs/compatibility.md) — unknown-field behavior vs TypeScript; Pydantic `extra="ignore"` policy.
- Tests: `tests/test_unknown_fields.py`.

### Changed

- CI: pass Sonar token for package scans; pin GitHub Actions to reviewed SHAs.
- Package smoke script: tighten sdist contents audit (required metadata files; exclude tests from sdist).

### Fixed

- Replace `tar` subprocess with stdlib `tarfile` in `scripts/smoke_package.py` (Bandit B607/B603).

## [0.1.1] - 2026-06-26

### Changed

- Track `uv.lock` for reproducible CI; restore `--frozen` installs in CI.
- Exclude `scripts/*` from coverage metrics (pytest-cov and Sonar).

### Fixed

- CI `uv export --frozen` without a tracked lockfile.
- Bandit subprocess findings in `scripts/smoke_package.py`.

## [0.1.0] - 2026-06-26

### Added

- `SECURITY.md`, Dependabot, standalone README, `CHANGELOG.md`, updated [RELEASING.md](./RELEASING.md).
- TreeSpec parity fixtures test suite.
- Expanded unit test coverage.
- Package artifact smoke test (`scripts/smoke_package.py`).

### Changed

- `pyproject.toml` project URLs and classifiers (Batch 3).
- README rewrite for standalone use (Batch 4).
- License changed from placeholder `UNLICENSED` metadata to MIT for public package readiness.

### CI

- Checks and tests on every PR; Sonar **`scan`** is label-gated on PRs and runs on tag push and manual dispatch (Batch 1).
- Publish only from manual **`main`** dispatch or **`v*`** tags (not PR labels); publish requires **`checks`**, **`tests`**, and **`scan`**.

### Documentation

- [RELEASING.md](./RELEASING.md) preflight verifies `LICENSE` and MIT metadata before release.

[Unreleased]: https://github.com/SignalSafeSoftware/tree-spec-python/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/SignalSafeSoftware/tree-spec-python/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/SignalSafeSoftware/tree-spec-python/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/SignalSafeSoftware/tree-spec-python/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/SignalSafeSoftware/tree-spec-python/releases/tag/v0.1.1
[0.1.0]: https://github.com/SignalSafeSoftware/tree-spec-python/releases/tag/v0.1.0
