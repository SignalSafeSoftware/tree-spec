# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.2] - 2026-06-26

### Changed

- Standardize development on Yarn 1.22.22 (`packageManager`, README dev commands).

### CI

- Publish job uses `yarn publish` with `NODE_AUTH_TOKEN` for npm registry auth.

## [0.3.1] - 2026-06-26

### Added

- `SECURITY.md` and Dependabot configuration.
- `CHANGELOG.md` and standalone release documentation.
- TreeSpec parity fixtures test suite.
- Expanded unit test coverage.
- Package artifact smoke test (`yarn smoke:package`).

### Changed

- Package metadata: `packageManager`, release hygiene (production-readiness Batch 3).
- README: standalone install, boundaries, and security notes (Batch 4).

### CI

- Checks and tests on every PR; Sonar **`scan`** is label-gated on PRs and runs on tag push and manual dispatch (Batch 1).
- Publish only from manual **`main`** dispatch or **`v*`** tags (not PR labels); publish requires **`checks`**, **`tests`**, and **`scan`**.

### Documentation

- Release process documented in [RELEASING.md](./RELEASING.md).

[Unreleased]: https://github.com/SignalSafeSoftware/tree-spec/compare/v0.3.2...HEAD
[0.3.2]: https://github.com/SignalSafeSoftware/tree-spec/releases/tag/v0.3.2
[0.3.1]: https://github.com/SignalSafeSoftware/tree-spec/releases/tag/v0.3.1
