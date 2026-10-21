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
publishes only after its checks, tests, scan, smoke, runtime compatibility and
distribution jobs succeed. Same-repository PRs run the Sonar scan; fork PRs skip
it. Configure `NPM_TOKEN` for non-interactive publishing; CI keeps auth in the
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

`ci.yml` is the sole push, pull-request and manual entry point. It calls
`typescript.yml` and `python.yml` as independent parallel jobs, with no dependency
between them. Pull-request label additions also trigger CI so adding the `scan`
label runs the Python Sonar scan. On pull requests, it also calls the independent reusable
`dependency-review.yml`, which blocks newly introduced high/critical vulnerabilities
in runtime, development and unknown dependency scopes. Each language retains its own checks, scans, cross-language distribution gate
and publisher. Coverage artifacts have distinct language names.

Manual dispatch on `main` can select either or both publish flags; both default
false. A `ts-v*` tag enables npm only; a `py-v*` tag enables PyPI only. Tags must
match their package versions. One publisher's failure does not skip or cancel the
other language job; the overall CI run still fails so partial releases are visible.
Retries require checking which version reached its registry before rerunning.

PyPI does not currently support trusted publishing from reusable workflows.
This architecture uses a package-scoped `PYPI_API_TOKEN` secret for the Python
publisher, disables trusted-publisher attestations, and retains the `pypi`
environment. The reusable workflow receives the repository secret; an environment
secret with the same name takes precedence in the publish job. See
[PyPI's reusable-workflow limitation](https://docs.pypi.org/trusted-publishers/troubleshooting/).
Configure this secret before release; no credential was created or publication run.

Dependabot checks GitHub Actions at `/`, the npm/Yarn workspace at `/` (where
`yarn.lock` lives), and the Python uv project at `/python`, all weekly. Adding
Python monitoring does not change package versions or dependency locks locally.
