# signalsafe-tree-spec (Python)

Python implementation of the **TreeSpec wire contract**: Pydantic models, parsing, lint, patch helpers, and constants. Backend counterpart to [`@signalsafe/tree-spec`](https://github.com/SignalSafeSoftware/tree-spec) on npm.

| | |
|---|---|
| **PyPI distribution name** | `signalsafe-tree-spec` |
| **Import path** | `deliveryplus_tree_spec` (stable; historical name) |
| **GitHub** | [SignalSafeSoftware/tree-spec-python](https://github.com/SignalSafeSoftware/tree-spec-python) |
| **Python** | 3.12+ (`requires-python >=3.12,<4.0`) |
| **Runtime dependency** | Pydantic v2 (`pydantic>=2.11.3,<3`) |

> **License:** MIT — see [LICENSE](./LICENSE). See [SECURITY.md](./SECURITY.md) for vulnerability reporting.

## What this package does

- Validate and parse **TreeSpec wire JSON** into typed Pydantic models (`TreeSpec`, `Node`, `Transition`, …).
- **Lint** wire payloads (`lint_tree_spec`) with structured issues, including
  duplicate choices, invalid references, unreachable nodes, and reachable paths
  that cannot reach `END`.
- **Build** wire documents programmatically (`TreeSpecBuilder`).
- **Apply JSON patches** to wire dicts (`apply_patch_to_spec_dict`).
- Expose wire constants (`END_NODE_ID`, `TREESPEC_WIRE_VERSION`).

See [docs/compatibility.md](./docs/compatibility.md) for how **unknown JSON fields** are handled (`extra="ignore"`) and how that compares to TypeScript compile/decompile.

## What this package does not do

- HTTP APIs, authentication, persistence, or training UI.
- Scenario simulation (use `@signalsafe/simulator-core` / `simulator-react` in TypeScript stacks).
- Graph editor UI (use `@signalsafe/tree-spec-editor-*` packages).
- General sandboxing or authorization — contract validation only; host apps decide trust and access control.

## Install

```bash
pip install signalsafe-tree-spec
```

Development (this repo uses [uv](https://docs.astral.sh/uv/)):

```bash
uv sync --extra dev
uv run pytest
```

## Distribution name vs import path

```bash
pip install signalsafe-tree-spec
```

```python
import deliveryplus_tree_spec
from deliveryplus_tree_spec import TreeSpec, lint_tree_spec, TreeSpecBuilder
```

The PyPI name (`signalsafe-tree-spec`) differs from the import path (`deliveryplus_tree_spec`) for backward compatibility with existing backends.

## Quick start

```python
from deliveryplus_tree_spec import (
    END_NODE_ID,
    TREESPEC_WIRE_VERSION,
    TreeSpec,
    TreeSpecBuilder,
    lint_tree_spec,
)

wire = {
    "wire_version": TREESPEC_WIRE_VERSION,
    "start_node": "start",
    "nodes": {
        "start": {
            "type": "prompt",
            "prompt": "Verify the sender before clicking?",
            "choices": [{"id": "inspect", "label": "Inspect sender"}],
        }
    },
    "transitions": [
        {"from": ["start", "inspect"], "to": END_NODE_ID, "outcome": "safe"},
    ],
}

issues = lint_tree_spec(wire)
assert not issues

spec = TreeSpec.model_validate(wire)
builder = TreeSpecBuilder()
# builder.add_node(...) — see tests/ for full builder flows
```

## Public API

All symbols below are exported from the top-level `deliveryplus_tree_spec` package:

| Category | Symbols |
|---|---|
| Constants | `END_NODE_ID`, `TREESPEC_WIRE_VERSION` |
| Models | `TreeSpec`, `Node`, `Transition`, `Choice`, `Delta`, `MicroFeedback`, `ABMeta`, `ABVariant`, … |
| Lint | `lint_tree_spec`, `TreeSpecIssue` (`level`/`severity`, stable `code`, optional `path`) |
| Builder | `TreeSpecBuilder`, `TreeSpecError` |
| Patch | `apply_patch_to_spec_dict`, `PatchApplyError`, `PatchDict`, `ReplacePatch`, … |

There are no subpath exports — import from `deliveryplus_tree_spec` only.

## Wire contract (high level)

- **`wire_version`:** optional; omit for implicit v1. Constant `TREESPEC_WIRE_VERSION` documents the current version string.
- **`start_node`:** entry node id.
- **`nodes`:** map of node id → node object (`type`, `prompt`, `choices` or legacy `options`, optional `render_hints`).
- **`transitions`:** list of `{ from: [nodeId, choiceId], to, outcome? }`. Terminal transitions target `END_NODE_ID` and require `outcome`.
- **`_meta`:** optional tree-level metadata (for example graph-editor viewport persisted by editor packages).

Legacy payloads may use `options` instead of `choices` and legacy terminal ids; both implementations normalize these to canonical `choices` and `END` on read. Python lint validates the wire shape your backend accepts.

## Python / TypeScript parity

| Concern | Python (`tree-spec-python`) | TypeScript (`@signalsafe/tree-spec`) |
|---|---|---|
| Wire models & lint | Pydantic models, `lint_tree_spec` | `TreeSpecWire`, `lintTreeSpecWire`, `lintTreeSpecGraph` |
| Authoring graph compile | — | `compileTreeSpec` / `decompileTreeSpec` |
| Cross-language fixtures | Share JSON fixtures in your product repo or CI | Same |

Keep fixture JSON in sync when changing wire rules in either language. Graph
diagnostics use the same canonical codes and JSON-like paths in both languages;
Python exposes the legacy `level` field and the equivalent read-only `severity`
property. Full compile/decompile parity lives in TypeScript today; Python
focuses on validation, lint, builder, and patch flows used by backends.

## Development

```bash
uv sync --extra dev
uv run pytest
uv run flake8 .
uv run python -m build   # wheel/sdist smoke — full artifact tests in Batch 6
```

## Security

See [SECURITY.md](./SECURITY.md). TreeSpec parsing is **contract validation**, not a sandbox. Validate and authorize TreeSpec JSON in your application layer before treating content as trusted.

## Changelog and releases

- [CHANGELOG.md](./CHANGELOG.md)
- [RELEASING.md](./RELEASING.md)

## Related packages

- [`@signalsafe/tree-spec`](https://github.com/SignalSafeSoftware/tree-spec) — TypeScript wire contract and compile/lint.
- [`tree-spec-editor-*`](https://github.com/SignalSafeSoftware/tree-spec-editor) — authoring UI (TypeScript/React).
