# TreeSpec parity fixtures

Mirrored JSON fixtures shared with `tree-spec/tests/fixtures/` (identical
filenames and payloads). Keep both directories aligned when adding or changing
fixtures.

## Valid

| File | Purpose |
|------|---------|
| `minimal-valid.json` | Start node, one choice, transition to END with outcome |
| `moderate-valid.json` | Multi-step path with transition feedback (round-trips through compile/decompile in TS and Python) |
| `valid-implicit-wire-version.json` | Omits `wire_version` (implicit v1) |

## Invalid — wire version

| File | Expected rejection |
|------|-------------------|
| `invalid-unsupported-wire-version.json` | Unsupported integer `wire_version` |
| `invalid-wire-version-boolean.json` | Boolean `wire_version` |

## Invalid — transitions / graph

| File | Python (`lint_tree_spec`) | TypeScript (`lintTreeSpecGraph`) |
|------|--------|----------------------------------|
| `invalid-end-without-outcome.json` | Parse error | Strict parse: missing END outcome |
| `invalid-non-end-outcome.json` | Parse error | Strict parse: `unexpected_nonterminal_outcome` |
| `invalid-missing-target.json` | Lint: `transition_target_not_found` | Graph lint: `transition_target_not_found` |
| `invalid-missing-transition.json` | Lint: `missing_choice_transition` | Graph lint: `missing_choice_transition` |
| `invalid-unreachable-node.json` | Lint: `unreachable_node` | Graph lint: `unreachable_node` |
| `invalid-duplicate-transition.json` | Lint: `duplicate_transition_source` | Graph lint: `duplicate_transition_source` |

Parity tests in `tree-spec/tests/parity-fixtures.test.ts` and
`tree-spec-python/tests/test_parity_fixtures.py` encode the shared wire
expectations. Strict TypeScript decoding and Python model parsing retain their
documented difference in unknown-field handling; graph diagnostics use the same
canonical issue codes and map Python `level` to TypeScript `severity`.

Unknown-field policy: see [../../docs/compatibility.md](../../docs/compatibility.md).
