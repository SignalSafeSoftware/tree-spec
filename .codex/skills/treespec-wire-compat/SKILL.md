---
name: treespec-wire-compat
description: "Change TreeSpec parsing, lint rules, issue codes, issue paths or normalization without breaking the TypeScript and Python contracts or their consumers. Use for any edit to tree-spec, tree-spec-python, or a host's TreeSpec validation."
metadata:
  short-description: "Keep TreeSpec JS and Python contracts in lockstep"
---

# TreeSpec wire compatibility

`@signalsafe/tree-spec` (TypeScript) and `signalsafe-tree-spec` (Python, import `deliveryplus_tree_spec`) implement one wire contract. Hosts translate their issues into product envelopes (for example Adventure Stories' `ApiStoryValidationIssueCode`), so codes and paths are public API.

## Workflow

1. Name the rule: parse shape, lint graph rule, normalization, or issue envelope. Decide whether it is generic (belongs in the packages) or product-specific (belongs in the host).
2. Read `docs/compatibility.md` in `tree-spec` and the matching Python tests before editing. Note intentional differences (unknown fields, `level` vs `severity`).
3. Change both packages, or record the intentional difference in `docs/compatibility.md` with a test that pins it.
4. Add a fixture per rule: `tree-spec/tests/fixtures` and `tree-spec-python/tests/fixtures`, exercised by `parity-fixtures.test.ts` and `test_parity_fixtures.py`.
5. Keep issue fields stable: `code`, `path` (starting `"tree_spec"`), `message`, `node_id`, `choice_id`, severity. New codes are additive; renaming or removing a code is a breaking change for every host.
6. Check hosts that map codes: grep the host for each code string and extend its mapping and contracts in the same plan. Hosts that cannot upgrade yet must keep a documented shim, listed in the change's follow-up notes.
7. Run each package's gates (`yarn typecheck && yarn lint && yarn test:coverage && yarn smoke:package`; `uv run pytest`). Coverage stays at 100%.

## Avoid

- Product rules (score dimensions, render-hint namespaces, asset checks) in either package.
- Interpreting opaque JSON buckets (`_meta`, `_ab`, `render_hints`, `feedback`, `delta`, `lessons_triggered`).
- Behavior changes that only one language implements.
- Treating `null` and absent identically for opaque JSON values; typed optional fields may accept `null`, extension values keep it.
