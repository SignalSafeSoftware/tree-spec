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

TypeScript details: [`tree-spec/typescript/docs/compatibility.md`](https://github.com/SignalSafeSoftware/tree-spec/blob/main/typescript/docs/compatibility.md).

Graph issue codes are shared with TypeScript (`duplicate_choice_id`,
`duplicate_transition_source`, `transition_node_not_found`,
`transition_choice_not_found`, `transition_target_not_found`,
`missing_choice_transition`, `unreachable_node`, and `no_terminal_path`).
Python keeps the historical `TreeSpecIssue.level` field and exposes the same
value through the read-only `severity` property.

---

## Python models (`tree_spec.models`)

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

## Additive complete authoring contract (unreleased)

`TreeSpecAuthoringDocument` / `validate_authoring_document` /
`authoring_json_schema` in Python and `validateAuthoringDocument` in TypeScript
are an **opt-in** stricter write boundary. Existing `TreeSpec`,
`TreeSpecBuilder`, `parseTreeSpecWire`, compile and lint behavior is unchanged.
The TypeScript runtime consumes a checked-in schema generated from the Python
Pydantic authority; regenerate with:

```sh
PYTHONPATH=python/src python python/scripts/export_authoring_schema.py typescript/src/authoringSchema.ts
```

The Python authoring tests run the generator in `--check` mode, so unsupported
schema keywords or stale generated output fail the gate. The generated schema
is the structural authority; TypeScript does not maintain another field-rule
list. Python exposes native Pydantic ValidationError diagnostics, while the
TypeScript result uses existing `invalid_field_type` / `invalid_field_value`
issues with paths starting `tree_spec`. These diagnostic envelopes intentionally
differ; mirrored fixtures pin identical JSON acceptance and exact value
preservation, rather than Pydantic's internal union error names/messages.

Core root, node, choice and transition objects reject extra keys. Root requires
`start_node`, `nodes`, `transitions`; nodes require `type`, `prompt`, `choices`;
choices require `id`, `label`; transitions require the two-string `from` array
and `to`. Optional keys stay absent and explicit null is accepted only where
the declared opaque JSON value permits it. No default keys, trimming,
`options` alias migration, `ab` alias migration or terminal-ID conversion is
performed. A `to` string equal to `__END__` is preserved verbatim; graph semantics
and any legacy-to-current conversion are separate, explicit operations.
Empty prompts/choices, missing targets and other unfinished *semantic* graphs
may pass structure; run appropriate graph lint before publication/execution.
This API does not represent missing required structural draft fields such as `{}`.

Opaque `_ab`, feedback, delta and lessons_triggered values remain arbitrary JSON;
`_meta` and render_hints are JSON objects with arbitrary string keys. No score,
asset, simulator, feedback or metadata namespace is interpreted here. Hosts own
those extension refinements, authorization and resource limits. Opaque numbers
are finite and within `±MAX_AUTHORING_JSON_NUMBER` (`2^53 - 1`) to preserve
interoperability with JavaScript; numeric strings and full-width ID strings stay
strings. Bounds appear in exported schema and both validators reject overflow.
Booleans remain booleans and are not coerced into numbers. Core wire_version,
when present, must be integer 1. Python rejects an explicit Python/decoded-JSON
float 1.0 for that integer field; JavaScript cannot distinguish numeric spellings
1 and 1.0 after parsing. This representational difference is intentional; neither
API converts authored strings/booleans to integers. String bounds count Unicode
code points in both validators. Nonfinite/cyclic/non-JSON extensions are rejected.

Validation is non-mutating. It is not a serialization/canonical-hash algorithm,
resource quota, imported-document migration, or proof of graph/product readiness.
Legacy runtime parsing and its prior opaque compatibility remain available.
