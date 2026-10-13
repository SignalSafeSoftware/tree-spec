# TreeSpec consolidation

TypeScript source, tests, examples and its public npm manifest live in `typescript/`;
Python source and its contract tests/tooling live in `python/`. The root is a private npm workspace. Both are owned by this repository.
Registry names and public imports remain `@signalsafe/tree-spec`, `signalsafe-tree-spec`
and `tree_spec`. Candidates are npm 0.4.3 and Python 0.4.0. Python 0.4 intentionally changes the import namespace to `tree_spec`.
Wire parsing, lint codes, normalization, extension preservation and runtime support are unchanged.

12 mirrored fixtures are byte-identical and each language exercises them. The new
`yarn check:distributions` gate verifies fixture parity and both distribution contents.
TypeScript/Python quality gates, isolated installs and wheel/sdist builds pass locally.
The new root Python workflow and both release branches must also pass on GitHub before release.

The original sibling `tree-spec-python` is preserved as recovery source; its standalone
publishing workflow is disabled by explicit user approval. PyPI trusted publishing
must be configured for the new repository/workflow. No hosts or published registries were changed.

## Local branch consolidation

The Sonar scanner 8.3.0 branch is merged. Node runtime support, cleanup, TypeScript 7
fixes, develop and the old 0.3.4 release branch were already ancestors of main.
The refactor branch's only extra commit prepares release 0.3.2; it is superseded
by main's 0.4.2 release and the preserved 0.4.3 packaging candidate, so it is retained
for history and not merged. All pre-existing uncommitted consolidation source is
preserved in `codex/package-source-snapshot-20261013`. No push or publication occurs.
