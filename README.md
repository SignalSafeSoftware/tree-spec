# TreeSpec

One repository owns the TreeSpec wire contract in two independently published distributions:

| Folder | Distribution | Public import |
| --- | --- | --- |
| `typescript/` | npm `@signalsafe/tree-spec` | `@signalsafe/tree-spec` |
| `python/` | PyPI `signalsafe-tree-spec` | `tree_spec` |

The root npm package is private and provides workspace commands. npm publishes from
`typescript/`; PyPI publishes from `python/`. Neither archive contains the other language.
Registry names, parser behavior, lint issues, normalization and supported runtimes are preserved.

Read [TypeScript documentation](typescript/README.md), [Python documentation](python/README.md),
[wire compatibility](typescript/docs/compatibility.md), and [release instructions](RELEASING.md).

From the repository root, run `yarn install --frozen-lockfile`, `yarn typecheck`,
`yarn lint`, `yarn test:coverage`, `yarn build`, and `yarn smoke:package`.
From `python/`, run `uv sync --frozen --extra dev`, `uv run pytest`, and `uv run python -m build`.
After building both distributions, run `yarn check:distributions` at the root.
`yarn publish:dry-run` checks the TypeScript distribution without publishing.

TypeScript uses `ts-v*` release tags and Python uses `py-v*` tags. Publication requires
explicit authorization and passing the corresponding workflow and shared boundary checks.

## Generated output

`typescript/dist/` contains compiled JavaScript and declarations.
`typescript/artifacts/` contains local npm tarballs (`yarn pack:local`).
`typescript/coverage/` contains TypeScript coverage reports.
`python/dist/` contains the wheel (`.whl`) and source archive (`.tar.gz`)
produced by `uv run python -m build` for upload to PyPI.
Python runtime sources live in `python/src/tree_spec/`.
Python caches, build metadata and its virtual environment stay inside `python/`.
All generated output is ignored by Git. Root `node_modules/` and `yarn.lock`
are shared Yarn workspace dependencies and remain at the repository root.
Root `docs/` and `scripts/` own cross-language documentation and checks.

Python 0.4 uses the generic `tree_spec` import namespace. Upgrade all Python
consumers together; the retired product-specific namespace is not provided.
