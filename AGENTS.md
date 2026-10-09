# Development rules

## Wire contract

`@signalsafe/tree-spec` owns the TreeSpec wire contract for TypeScript; `signalsafe-tree-spec` (Python, `../tree-spec-python`) owns the same contract for Python. A change to parsing, lint rules, issue codes, issue paths or normalization must land in both, with matching fixtures in `tests/fixtures` and the Python `tests/fixtures`. Update `docs/compatibility.md` when behavior differs by design. Follow `.codex/skills/treespec-wire-compat/SKILL.md`.

- The package is product-neutral. Scoring dimensions, render-hint namespaces, asset rules and unknown-field strictness belong to the host; expose hooks or return generic issues instead of adding product rules.
- `parseTreeSpecWire` must stay total: never throw on untrusted input, return stable `code` + `path` (and `node_id`/`choice_id` anchors) for every issue.
- Opaque JSON extension buckets (`_meta`, `_ab`, `render_hints`, `feedback`, `delta`, `lessons_triggered`) are preserved, not interpreted.

## Quality gates

Run `yarn typecheck`, `yarn lint`, `yarn test:coverage` (coverage stays at 100%) and `yarn smoke:package` for every change. Run `yarn publish:dry-run` when `package.json`, `files` or exports change. Published runtime support is Node >=19; keep source free of newer runtime APIs.

## Releases

Follow `.codex/skills/ecosystem-release/SKILL.md`. Dependents use caret ranges on 0.x versions, so a minor bump orphans every dependent range: prefer patch bumps for compatible changes and update dependent ranges in the same release plan. Never tag, publish or push without explicit user approval.
