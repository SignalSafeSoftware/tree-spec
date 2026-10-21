# Combined repository releases

The private root npm workspace is tooling only. The public npm package
`@signalsafe/tree-spec` is built and published from `typescript/`. The PyPI
package `signalsafe-tree-spec` is built and published from `python/`.
Versions remain independent; public package names and imports are unchanged.

## Validation

Use Node 24 for development. The npm runtime supports Node >=19.0.0;
CI checks packed runtime imports on Node 19–24, including exactly 19.0.0.
From the repository root:

```sh
yarn install --frozen-lockfile
yarn lint
yarn typecheck
yarn test:coverage
yarn build
yarn smoke:package
yarn publish:dry-run
(cd python && uv sync --frozen --extra dev && uv run pytest && uv run python -m build)
yarn check:distributions
```

Python CI runs strict types and tests on Python 3.12, 3.13 and 3.14, plus lint,
security checks and an isolated wheel smoke test.
Both language fixtures and distribution boundaries must pass before release.

## npm release

Update `typescript/package.json` and `typescript/CHANGELOG.md`. The CI workflow
publishes only after both language quality workflows and the combined Sonar quality
gate succeed. Same-repository PRs run the combined scan; fork PRs skip it and
cannot publish. Configure `NPM_TOKEN` for non-interactive publishing; CI keeps auth in the
runner's npm configuration, never in this repository.

An explicitly requested release can use `ts-v<typescript/package.json version>`
or manual CI dispatch on `main` with `publish_npm` enabled. Manual dispatch defaults
to checks only. The publish step runs `npm publish --access public --ignore-scripts`
inside `typescript/`, after building and checking the package.

## Python release

Update `python/src/tree_spec/VERSION` and `python/CHANGELOG.md`. The Python workflow publishes
only for `py-v<python/src/tree_spec/VERSION>` or manual CI dispatch on `main` with `publish_pypi` enabled,
after all required jobs pass. Configure a package-scoped `PYPI_API_TOKEN` secret
in the repository or `pypi` environment. Only `python/dist/` is uploaded to PyPI.

Repository consolidation does not authorize a release, tag, push or publication.

## Parallel workflow ownership

`ci.yml` is the sole push, pull-request and manual entry point. Its quality-only
`typescript.yml` and `python.yml` reusable children run in parallel and retain all
language checks, runtime compatibility, packed smoke, shared wire fixtures and
distribution boundaries. Children no longer accept the internal `publish` input
or publishing secrets: a child invocation cannot publish before the combined gate.
The root dependency-review job still blocks newly introduced high/critical risks.

After **both** children succeed, one root scan analyzes both languages under
`SignalSafeSoftware_tree-spec-ts`. There is no submission to a separate Python
project. Distinct coverage artifacts include hashes of every authored runtime
source file. Before scanning, CI verifies those bytes against its checkout and
normalizes LCOV/XML filenames to actual repository-root paths. A separate measured
XML report covers CI coverage/distribution tooling and actual schema generation without changing runtime thresholds. Both existing
runtime coverage thresholds remain 100%; scripts and workflows remain visible
to analysis without claiming runtime coverage for infrastructure.

Root publisher jobs require successful TypeScript, Python and combined quality
gate results. A skipped or failed combined gate cannot publish. Public interfaces
are unchanged: manual dispatch on `main` can select either or both `publish_npm`
and `publish_pypi` flags (default false); `ts-v*` selects npm and `py-v*` selects
PyPI. Existing exact tag/version checks remain. Publisher failures remain visible
independently; check registries before retrying a partial release.

The PyPI publisher retains package-scoped `PYPI_API_TOKEN`, the `pypi` environment,
`python/` command working directory and `python/dist/` upload path. An environment
secret of the same name takes precedence. npm retains `NPM_TOKEN` and publication
from `typescript/`. Moving publishers to root does not change authentication or
authorize a release; no tags or publication are part of this CI migration.

Dependabot checks GitHub Actions at `/`, the npm/Yarn workspace at `/` (where
`yarn.lock` lives), and the Python uv project at `/python`, all weekly. Adding
Python monitoring does not change package versions or dependency locks locally.

The internal distribution checker receives the packed npm archive as gzip bytes
on stdin, never as a filesystem argument. `yarn check:distributions` remains the
public command and validates both archives and mirrored wire fixtures. Its npm
CLI is resolved beside the current Node executable without a PATH lookup.
