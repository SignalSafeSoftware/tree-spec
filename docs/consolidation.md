# TreeSpec consolidation

The existing TypeScript package remains at the repository root; the Python source and
its contract tests/tooling now live in `python/`. Both are owned by this repository.
Registry names and public imports remain `@signalsafe/tree-spec`, `signalsafe-tree-spec`
and `deliveryplus_tree_spec`. Packaging patch candidates are npm 0.4.3 and Python 0.3.1.
Wire parsing, lint codes, normalization, extension preservation and runtime support are unchanged.

11 mirrored fixtures are byte-identical and each language exercises them. The new
`yarn check:distributions` gate verifies fixture parity and both distribution contents.
TypeScript/Python quality gates, isolated installs and wheel/sdist builds pass locally.
The new root Python workflow and both release branches must also pass on GitHub before release.

The original sibling `tree-spec-python` is preserved as recovery source; its standalone
publishing workflow is disabled by explicit user approval. PyPI trusted publishing
must be configured for the new repository/workflow. No hosts or published registries were changed.
