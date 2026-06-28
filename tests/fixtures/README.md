# TreeSpec parity fixtures

Mirrored JSON fixtures shared with `tree-spec-python/tests/fixtures/` (identical
filenames and payloads). Keep both directories aligned when adding or changing
fixtures.

## Valid

| File | Purpose |
|------|---------|
| `minimal-valid.json` | Start node, one choice, transition to END with outcome |
| `moderate-valid.json` | Multi-step path with transition feedback (round-trips through compile/decompile) |
| `valid-implicit-wire-version.json` | Omits `wire_version` (implicit v1) |

## Invalid — wire version

| File | Expected rejection |
|------|-------------------|
| `invalid-unsupported-wire-version.json` | Unsupported integer `wire_version` |
| `invalid-wire-version-boolean.json` | Boolean `wire_version` |

## Invalid — transitions / graph

| File | Python | TypeScript (`lintTreeSpecWire`) |
|------|--------|----------------------------------|
| `invalid-end-without-outcome.json` | Parse error | Lint: missing END outcome |
| `invalid-non-end-outcome.json` | Parse error | **Gap:** lint passes today |
| `invalid-missing-target.json` | Lint: `missing_target_node` | **Gap:** lint passes today |
| `invalid-missing-transition.json` | Lint: `missing_transition` | **Gap:** lint passes today |
| `invalid-unreachable-node.json` | Lint: `unreachable_node` | **Gap:** lint passes today |
| `invalid-duplicate-transition.json` | Lint: `duplicate_transition` | **Gap:** lint passes today |

Parity tests in `tests/parity-fixtures.test.ts` and `tree-spec-python/tests/test_parity_fixtures.py`
encode shared expectations and document known gaps without changing runtime behavior.

Unknown-field policy (extension keys, compile/decompile lossiness, TS vs Python): see [../docs/compatibility.md](../docs/compatibility.md).
