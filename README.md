# TreeSpec

One repository owns the TreeSpec wire contract in two independently published distributions:

| Folder | Distribution | Public import |
| --- | --- | --- |
| `typescript/` | npm `@signalsafe/tree-spec` | `@signalsafe/tree-spec` |
| `python/` | PyPI `signalsafe-tree-spec` | `deliveryplus_tree_spec` |

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
