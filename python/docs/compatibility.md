# TreeSpec unknown-field compatibility

This document describes how **unknown JSON fields** are handled in **`signalsafe-tree-spec`** (Python / Pydantic) and how that compares to [`@signalsafe/tree-spec`](https://github.com/SignalSafeSoftware/tree-spec) (TypeScript).

**Policy summary**

| Layer | Unknown fields |
| ----- | -------------- |
| **Stable contract** | Only documented wire keys are guaranteed across tools and languages. |
| **Extension / product metadata** | Prefer `_meta` (and documented namespaces such as `_meta.graph_editor`). |
| **Parse** | Pydantic models use `model_config = ConfigDict(extra="ignore")` — unknown keys are **silently dropped**, not rejected. |
| **Lint** | `lint_tree_spec` does not warn on unknown keys; graph diagnostics use the canonical stable codes and optional paths shared with TypeScript. |
| **Serialization** | `model_dump(by_alias=True)` emits only modeled fields plus preserved dict buckets. |

TypeScript details: [`tree-spec/docs/compatibility.md`](https://github.com/SignalSafeSoftware/tree-spec/blob/main/docs/compatibility.md).

Graph issue codes are shared with TypeScript (`duplicate_choice_id`,
`duplicate_transition_source`, `transition_node_not_found`,
`transition_choice_not_found`, `transition_target_not_found`,
`missing_choice_transition`, `unreachable_node`, and `no_terminal_path`).
Python keeps the historical `TreeSpecIssue.level` field and exposes the same
value through the read-only `severity` property.

---

## Python models (`deliveryplus_tree_spec.models`)

All wire models (`TreeSpec`, `Node`, `Choice`, `Transition`, `MicroFeedback`, …) set **`extra="ignore"`**.

| Location | Unknown field example | Parse | `model_dump(by_alias=True)` |
| -------- | --------------------- | ----- | --------------------------- |
| **Root** | `"experimental_flag": true` | Ignored | Not emitted |
| **Root** | `"_meta": { "custom": 1 }` | Stored in `meta` | Emitted as `"_meta"` |
| **Node** | `"legacy_flag": true` on a node | Ignored | Not emitted |
| **Node** | `"render_hints": { "editor": {}, "vendor": {} }` | Stored | Nested unknown keys **preserved** in dict |
| **Choice** | `"tooltip": "x"` | Ignored | Not emitted |
| **Choice** | `"render_hints": { "editor": {} }` | Stored | Nested unknown keys **preserved** in dict |
| **Choice** | `"feedback": { "title": "Hi" }` | Parsed into `MicroFeedback` | Known keys only |
| **Transition** | `"note": "internal"` | Ignored | Not emitted |
| **Transition** | `"feedback"`, `"delta"`, `"lessons_triggered"` | Parsed | Emitted when set |
| **MicroFeedback** | `"vendor_tag": "x"` inside feedback | Ignored | Not emitted — **TS keeps opaque extras** |

### Validation errors (known fields)

Invalid **known** fields still fail parse, for example:

- Unsupported `wire_version`
- END transition without `outcome`
- Non-END transition with `outcome`

These align with TypeScript `parseTreeSpecWire` and `lintTreeSpecGraph` for the
overlapping rules. Python's Pydantic parser raises `ValidationError`, while the
TypeScript decoder returns a discriminated validation result.

---

## Comparison with TypeScript compile/decompile

| Concern | TypeScript `compileTreeSpec` / `decompileTreeSpec` | Python `TreeSpec.model_validate` / `model_dump` |
| ------- | --------------------------------------------------- | ----------------------------------------------- |
| Unknown root keys | Dropped on round-trip | Ignored on parse |
| `_meta` extensions | Preserved | Preserved |
| `render_hints` on nodes | Preserved (opaque) | Preserved (dict) |
| Choice `render_hints` | Preserved | Preserved (dict) |
| Extra keys inside `feedback` | Preserved (opaque) | **Stripped** by `MicroFeedback` (accepted difference) |
| Lint unknown keys | No | No |

---

## Examples

Legacy `options` collections are normalized to canonical `choices`, and the legacy
`__END__` target is normalized to `END`, matching TypeScript decompile behavior.
See the TypeScript doc for JSON samples. Behavior for `_meta` and invalid
`wire_version` matches the examples there.

---

## Tests

- Python: `tests/test_unknown_fields.py`
- TypeScript: `tests/unknown-fields.test.ts`
- Shared fixtures: `tests/fixtures/README.md`
