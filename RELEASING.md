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

Python CI also runs lint, security checks and an isolated wheel smoke test.
Both language fixtures and distribution boundaries must pass before release.

## npm release

Update `typescript/package.json` and `typescript/CHANGELOG.md`. The CI workflow
publishes only after its checks, tests, scan, smoke, runtime compatibility and
distribution jobs succeed. Same-repository PRs run the Sonar scan; fork PRs skip
it. Configure `NPM_TOKEN` for non-interactive publishing; CI keeps auth in the
runner's npm configuration, never in this repository.

An explicitly requested release can use `ts-v<typescript/package.json version>`
or manual CI dispatch on `main` with `publish` enabled. Manual dispatch defaults
to checks only. The publish step runs `npm publish --access public --ignore-scripts`
inside `typescript/`, after building and checking the package.

## Python release

Update `python/VERSION` and `python/CHANGELOG.md`. The Python workflow publishes
only for `py-v<python/VERSION>` or manual dispatch on `main` with `publish` enabled,
after all required jobs pass. Configure PyPI trusted publishing for this
repository's `python.yml` workflow and `pypi` environment. Only `python/dist/`
is uploaded to PyPI.

Repository consolidation does not authorize a release, tag, push or publication.
