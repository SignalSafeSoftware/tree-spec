# Development rules

## Wire contract

`signalsafe-tree-spec` is the Python half of the TreeSpec wire contract; `@signalsafe/tree-spec` (`..`) is the TypeScript half. Keep issue codes, issue `path` values, normalization (`options` -> `choices`, `__END__` -> `END`) and the cross-language `severity` naming identical. Add a fixture to `tests/fixtures` for every new rule and mirror it in the TypeScript package. Follow `../.codex/skills/treespec-wire-compat/SKILL.md`.

- The distribution name is `signalsafe-tree-spec`; the import path is `deliveryplus_tree_spec` (flat layout, `package-dir` maps `.`). Do not rename either without a coordinated migration of every consumer.
- Lint returns issues with `path`; hosts translate them to their own envelopes. Do not add host-specific codes or product rules here.
- Pydantic models enforce shape (for example END requires an outcome); lint covers graph rules. Hosts that need to report both must project documents so the models accept them.

## Quality gates

Run `uv sync --extra dev`, `uv run pytest` (coverage must stay at 100%) and `uv run python -m build` for every change. Run `flake8` and `bandit` when touching parsing or models.

## Releases

Version lives in `VERSION`; update `CHANGELOG.md` in the same change. Follow `../.codex/skills/ecosystem-release/SKILL.md`. Never tag, publish or push without explicit user approval.
