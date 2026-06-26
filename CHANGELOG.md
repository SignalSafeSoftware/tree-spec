# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `SECURITY.md` and Dependabot configuration.
- `CHANGELOG.md` and standalone release documentation.

### Changed

- Package metadata: `packageManager`, release hygiene (production-readiness Batch 3).
- README: standalone install, boundaries, and security notes (Batch 4).

### CI

- Checks and tests on every PR; Sonar **`scan`** is label-gated on PRs and runs on tag push and manual dispatch (Batch 1).
- Publish only from manual **`main`** dispatch or **`v*`** tags (not PR labels); publish requires **`checks`**, **`tests`**, and **`scan`**.

### Documentation

- Release process documented in [RELEASING.md](./RELEASING.md).

## [0.3.1]

Prior published release on npm (`@signalsafe/tree-spec`). Detailed historical notes were not recorded in this repository.

[Unreleased]: https://github.com/SignalSafeSoftware/tree-spec/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/SignalSafeSoftware/tree-spec/releases/tag/v0.3.1
