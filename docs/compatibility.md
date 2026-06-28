# TreeSpec unknown-field compatibility

This document describes how **unknown JSON fields** (keys not defined in the TreeSpec wire contract) are handled in `@signalsafe/tree-spec` (TypeScript) and how that compares to [`signalsafe-tree-spec`](https://github.com/SignalSafeSoftware/tree-spec-python) (Python / Pydantic).

**Policy summary**

| Layer | Unknown fields |
| ----- | -------------- |
| **Stable contract** | Only documented wire keys are guaranteed across tools and languages. |
| **Extension / product metadata** | Prefer `_meta` (and documented namespaces such as `_meta.graph_editor`). |
| **Parse / guard** | Neither TS nor Python **rejects** unknown top-level keys by default. |
| **Lint** | Neither implementation emits warnings for unknown keys today. |
| **Round-trip through models** | Unknown keys are **not preserved** except in documented opaque buckets (see below). |

Python parity details live in the mirrored doc in `tree-spec-python/docs/compatibility.md`.

---

## TypeScript (`@signalsafe/tree-spec`)

### Parse and guard

- `isTreeSpecWire(value)` checks only that the value is an object with `start_node` and `nodes`. **Unknown root keys are allowed.**
- There is no strict JSON Schema pass in this package; hosts may add server-side validation.

### Lint (`lintTreeSpecWire`)

Validates a small set of **known** rules today:

- `wire_version` shape and supported value
- END transitions must include `outcome`

**Unknown fields are not linted** (no warning, no error).

### Compile / decompile (`compileTreeSpec` / `decompileTreeSpec`)

The authoring graph (`TreeGraph`) is a **whitelisted projection** of wire JSON. A compile → decompile → compile round-trip **drops** keys that are not mapped into the graph model, except where noted below.

| Location | Unknown field example | Round-trip through compile/decompile |
| -------- | --------------------- | ------------------------------------ |
| **Root** | `"product_id": "x"` | **Dropped** |
| **Root** | `"_meta": { "custom": 1 }` | **Preserved** (`TreeGraph._meta`) |
| **Root** | `"_ab": { ... }` | **Preserved** (`TreeGraph._ab`) |
| **Node** | `"nodes.s.legacy_flag": true` | **Dropped** |
| **Node** | `"render_hints": { "theme": {}, "editor": {} }` | **Preserved** (opaque object; nested unknown keys kept) |
| **Choice** | `"choices[].tooltip": "x"` | **Dropped** |
| **Choice** | `"choices[].render_hints"` | **Preserved** |
| **Choice** | `"choices[].feedback"` | **Preserved** (Prompt 14+) |
| **Transition** | `"transitions[].note": "x"` | **Dropped** |
| **Transition** | `"feedback"`, `"delta"`, `"lessons_triggered"` | **Preserved** (Prompt 14+) |
| **Feedback object** | `"feedback": { "title": "Hi", "vendor_tag": "x" }` | **Preserved as opaque JSON** (whole object stored on graph transition/choice) |

**Important:** Passing wire JSON through compile/decompile is **lossy** for unknown keys. Hosts that must retain arbitrary extensions should either keep the original wire dict or store extensions under `_meta`.

### Known optional wire fields (stable round-trip)

These are **not** unknown — they are part of the contract and round-trip since `@signalsafe/tree-spec@0.3.3`:

- `transitions[].feedback`, `delta`, `lessons_triggered`
- `choices[].feedback`

At runtime, `@signalsafe/simulator-core` resolves feedback with **transition first, then choice** (`resolveFeedbackForTransition`). Compile/decompile does not merge or prioritize.

---

## Python (`signalsafe-tree-spec`) — comparison

| Location | TypeScript | Python (Pydantic `extra="ignore"`) |
| -------- | ---------- | ------------------------------------- |
| Root unknown key | Allowed; dropped on compile/decompile | **Ignored on parse**; absent from `model_dump()` |
| `_meta` unknown nested keys | Preserved | **Preserved** (`meta: Dict[str, object]`) |
| Node `render_hints` unknown nested keys | Preserved | **Preserved** |
| Node unknown top-level key | Dropped on compile/decompile | **Ignored on parse** |
| Choice `render_hints` | Preserved | **Not modeled** — ignored on parse (editor-only in TS stack) |
| Choice unknown key | Dropped on compile/decompile | **Ignored on parse** |
| Transition unknown key | Dropped on compile/decompile | **Ignored on parse** |
| Feedback unknown nested key | Preserved (opaque object) | **Stripped** (`MicroFeedback` uses `extra="ignore"`) |

These differences are **accepted** for now: Python models validate known feedback shape; TypeScript keeps feedback as opaque `unknown` for forward compatibility.

---

## Examples

### Accepted — extension under `_meta`

```json
{
  "start_node": "s",
  "nodes": { "s": { "type": "prompt", "prompt": "Hi", "choices": [] } },
  "transitions": [],
  "_meta": { "authoring_tool": "demo", "custom_bucket": { "any": "json" } }
}
```

Both TS compile/decompile and Python parse preserve `_meta` / custom nested keys.

### Accepted — unknown root key (not rejected)

```json
{
  "start_node": "s",
  "nodes": { "s": { "type": "prompt", "prompt": "Hi", "choices": [] } },
  "transitions": [],
  "experimental_flag": true
}
```

- **TS:** `isTreeSpecWire` passes; `lintTreeSpecWire` passes; key is **dropped** after compile/decompile.
- **Python:** `TreeSpec.model_validate` succeeds; key is **not** in the model or `model_dump()`.

### Rejected — invalid known field

```json
{
  "wire_version": true,
  "start_node": "s",
  "nodes": {},
  "transitions": []
}
```

- **TS lint:** error — `wire_version must be an integer when present`
- **Python parse:** `ValueError` — same rule

---

## Tests

- TypeScript: `tests/unknown-fields.test.ts`
- Python: `tests/test_unknown_fields.py`
- Shared fixtures: `tests/fixtures/README.md`
