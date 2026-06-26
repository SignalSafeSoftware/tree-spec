I reviewed the repo files I could access for `SignalSafeSoftware/tree-spec`. Overall: **this is already in decent shape for a small public TypeScript package**, but I would not call it “release-hard” yet. The biggest improvements are **validation depth, CI release safety, public-package docs, and package-manager cleanup**.

## Executive take

You have a clean package boundary: ESM-only, typed exports, no runtime dependencies, MIT license, published files limited to `dist`, `README.md`, and `LICENSE`, and a clear package description. The package metadata looks professional. `package.json` exposes `main`, `types`, and an `exports` map, marks `"sideEffects": false`, requires Node `>=18`, and only ships the intended package files.

The main risk is that the package name and README imply “TreeSpec validation / linting,” but the actual runtime checks are very light. `isTreeSpecWire` only verifies that an object has `nodes` and `start_node`, and `lintTreeSpecWire` mainly checks `wire_version` plus missing outcomes on END transitions.

## Highest-priority fixes

### 1. Strengthen `lintTreeSpecWire`

Right now, the linter does **not** appear to check most of the things users would expect from a graph format linter:

It should probably flag:

| Case                                                           | Why it matters                     |
| -------------------------------------------------------------- | ---------------------------------- |
| `start_node` missing from `nodes`                              | Runtime cannot start safely        |
| transition `from[0]` node does not exist                       | Broken graph                       |
| transition `from[1]` choice does not exist on source node      | Broken decision path               |
| transition target does not exist and is not `END` / legacy END | Broken graph                       |
| duplicate node IDs / choice IDs                                | Ambiguous runtime behavior         |
| duplicate transition from same `(node, choice)`                | Ambiguous routing                  |
| terminal outcome not one of `safe`, `at_risk`, `compromised`   | Bad analytics/runtime contract     |
| unreachable nodes                                              | Helpful editor warning             |
| non-terminal dead ends                                         | User can get stuck                 |
| bad node/choice shape                                          | Helpful when loading external JSON |

The README says `END` transitions must include an `outcome`, which your current linter checks.  But because `TreeSpecWire` is likely to be used with unknown JSON, the linter should be much more defensive.

I would rename the current function mentally as “basic lint” and expand it before a stable public release.

### 2. Do not silently default missing terminal outcomes in `compileTreeSpec`

`compileTreeSpec` currently defaults missing END outcomes to `at_risk`.  That is convenient, but risky because it can hide authoring bugs. Since your contract says END transitions must include an outcome, I would consider one of these:

```ts
compileTreeSpec(tree, { defaultTerminalOutcome: "at_risk" })
```

or

```ts
compileTreeSpecStrict(tree) // throws on missing END outcome
compileTreeSpecLoose(tree)  // current behavior
```

For a public package, silent correction is fine for “decompile/normalize,” but compile usually should not invent semantic outcomes unless the caller opts in.

### 3. Add CI release protection before `yarn publish`

Your workflow has a `publish` job that can publish from `workflow_dispatch` or a PR with a `publish` label, and it runs `yarn publish --access public --non-interactive`.  I would harden this before relying on it:

```yaml
permissions:
  contents: read
  id-token: write
```

Then publish with npm trusted publishing / provenance if possible. Also add an environment gate, for example:

```yaml
environment: npm-production
```

And make sure PR-triggered publish cannot publish untrusted code. I would personally **avoid publishing from PR events entirely** and only publish on GitHub Release, tag push, or manual dispatch from `main`.

### 4. Add a `SECURITY.md`

I checked for `SECURITY.md` and did not find one. For a security-awareness company/package, that absence stands out. Add a short file:

```md
# Security Policy

Please do not open public issues for vulnerabilities.

Report security concerns to: security@signalsafe.software

Supported versions:
- Latest minor release only until 1.0
```

Even if this package is small, it signals maturity.

### 5. Add `CHANGELOG.md`

I also did not find a `CHANGELOG.md`. Since this is a public contract package and `wire_version` exists, a changelog is important. You should document:

```md
## 0.3.1
- Added graph editor metadata helpers.
- Added render_hints.editor graph position helpers.
- Clarified legacy END compatibility.

## Compatibility
- `wire_version` omitted means implicit v1.
- `__END__` is accepted on read and normalized to `END`.
```

Your README already explains the monorepo architecture and the wire contract, which is good.  A changelog would make version-to-version risk clearer.

## Documentation advice

Your README is much better than average. It has install instructions, typed examples, quick start, legacy normalization, branching examples, multi-node graph examples, graph editor metadata, and contract notes.

I would add four missing sections:

### “What this package does not do”

This matters because your package is part of a larger system.

```md
## What this package does not do

This package does not execute scenarios, score attempts, store analytics,
render React components, or validate product-specific metadata. It only
provides TreeSpec types, compile/decompile helpers, graph metadata helpers,
and structural linting.
```

That matches your `index.ts` package comment: “No React, simulator runtime, or transport — consumers add those layers.”

### “Validation guarantees”

Be very explicit:

```md
`isTreeSpecWire` is a minimal shape guard, not a full validator.
`lintTreeSpecWire` performs structural checks and returns issues.
Server-side/product validation may still be required for domain-specific fields.
```

This is important because the current guard is intentionally minimal.

### “Versioning policy”

Because `wire_version` is part of the format:

```md
## Versioning policy

Package semver and `wire_version` are separate.

- Patch/minor package releases may add helpers without changing the JSON shape.
- `wire_version` changes only when the serialized TreeSpec wire contract changes.
- Consumers should reject unsupported explicit `wire_version` values.
```

This matches your lint behavior, which rejects unsupported `wire_version` values.

### “Common recipes”

Add copy-paste examples:

```ts
const raw: unknown = JSON.parse(input);

if (!isTreeSpecWire(raw)) {
  throw new Error("Not TreeSpec-shaped");
}

const issues = lintTreeSpecWire(raw);
if (issues.some((i) => i.severity === "error")) {
  throw new Error(JSON.stringify(issues));
}

const graph = decompileTreeSpec(raw);
```

## Test advice

Your tests are meaningful and cover several important paths: compile/decompile round trips, legacy END/options normalization, missing/loose payload behavior, render hints, graph editor metadata, lint behavior, and crypto UUID fallback.

I would add these tests next:

### Linter graph-validity tests

Add tests for:

```ts
it("flags missing start node")
it("flags transition from unknown node")
it("flags transition from unknown choice")
it("flags transition to unknown node")
it("flags duplicate transitions for same node choice")
it("flags invalid terminal outcome")
it("warns for unreachable nodes")
it("warns for non-terminal node with no outgoing transitions")
```

### Public API compile test

Add a test that imports from package root only:

```ts
import {
  compileTreeSpec,
  decompileTreeSpec,
  lintTreeSpecWire,
} from "../src/index";
```

That catches accidental non-exported helpers or import-path drift.

### Tarball smoke test in CI

You already have scripts for dry-run/package checks in `package.json`, but the CI workflow does not appear to run the package tarball checks before publish. The scripts include `publish:dry-run`, `pack:check`, `smoke:external`, and `smoke:published`.  Add at least this to CI:

```bash
npm run build
npm pack
node scripts/smoke-tree-spec-external-consumer.mjs --source ./signalsafe-tree-spec-*.tgz
```

Since this repo may have been extracted from a monorepo, some scripts currently point to `../../scripts/...`, which may not exist in the standalone repo.  That is a potential issue: either vendor those scripts here, remove them, or update the README to explain they only work in the monorepo.

## Security notes

Good: `safeUUID` uses Web Crypto and avoids `Math.random`, with fallback to `crypto.getRandomValues`.  That is appropriate.

Concerns:

1. **No full runtime validation yet.** The biggest “security” issue is malformed/untrusted JSON causing incorrect simulator/editor behavior. Strengthen linting before encouraging external consumers to load arbitrary TreeSpec JSON.

2. **Public publish workflow needs hardening.** Avoid publishing from PR events; use tag/release/manual from `main`, require environment approval, and use npm provenance/trusted publishing.

3. **Mixed lockfiles.** The repo has both `package-lock.json` and `yarn.lock`. CI installs with Yarn v1 using `yarn install --frozen-lockfile`, but npm metadata and scripts are also present.    Pick one package manager. Since CI uses Yarn, I’d remove `package-lock.json` unless you intentionally support npm installs too.

4. **Pin or rationalize Node version.** `package.json` supports Node `>=18`, but CI runs Node 24.   Add a test matrix for Node 18, 20, 22, and 24, or set CI to the lowest supported version so you catch accidental use of newer APIs.

## Packaging advice

The package setup is mostly strong:

```json
"main": "./dist/index.js",
"types": "./dist/index.d.ts",
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "default": "./dist/index.js"
  }
}
```

That is clean for ESM consumers.

I would add:

```json
"packageManager": "yarn@1.22.22"
```

or switch fully to npm and remove `yarn.lock`.

Also consider whether `prepare` should run `npm run build`.  For public packages, `prepare` can surprise contributors because it runs on local install and git dependency installs. If you only need build before publish, `prepublishOnly` may be enough.

## Code-quality observations

### `readGraphEditorMeta` parses the same fields repeatedly

This is minor, but `readGraphEditorMeta` calls `parseGraphPosition`, `parseViewport`, and `parseEdgeType` multiple times in conditional spreads.  Cleaner:

```ts
const end_position = parseGraphPosition(bucket.end_position);
const viewport = parseViewport(bucket.viewport);
const default_edge_type = parseEdgeType(bucket.default_edge_type);

return {
  ...(end_position ? { end_position } : {}),
  ...(viewport ? { viewport } : {}),
  ...(default_edge_type ? { default_edge_type } : {}),
};
```

### `uuidV4FromBytes` mutates the passed array

`uuidV4FromBytes` modifies `bytes[6]` and `bytes[8]`.  That is okay internally, but exported-for-tests functions can become used accidentally. Either document the mutation or copy first:

```ts
const b = bytes.slice(0, 16);
```

### Style consistency

Most files use double quotes, but `graphEditorMeta.ts` uses single quotes for the edge type union and parser.   Not important, but adding Prettier would prevent style drift.

## CI/Sonar observations

The CI has typecheck, tests with coverage, Sonar scan, and upload of `lcov.info`.  The Sonar config is straightforward and points to `src`, `tests`, and `coverage/lcov.info`.

The unusual part is that PR checks only run when labels are present:

```yaml
contains(github.event.pull_request.labels.*.name, 'checks')
contains(github.event.pull_request.labels.*.name, 'tests')
contains(github.event.pull_request.labels.*.name, 'scan')
```

That can be okay if intentional, but for a public/package contract repo I would run typecheck and tests on every PR by default. Keep label-gating only for expensive scans.

## Priority checklist

I’d do this order:

1. **Expand `lintTreeSpecWire`** to validate graph references, outcomes, duplicates, and unreachable/dead-end nodes.
2. **Remove or make explicit the default `at_risk` outcome** in `compileTreeSpec`.
3. **Harden publish workflow**: publish only from `main` tags/releases/manual approval, not PR labels.
4. **Add `SECURITY.md`, `CHANGELOG.md`, and `CONTRIBUTING.md`.**
5. **Choose one lockfile/package manager.**
6. **Add Node version matrix**, especially Node 18 because your package claims support for `>=18`.
7. **Run tarball smoke tests in CI** so you know `dist`, declarations, and exports work after packing.
8. **Document validation guarantees** clearly in README.
9. **Add Prettier/ESLint** if you want consistency.
10. **Consider generated schema** later, such as JSON Schema or Zod, if external consumers will submit arbitrary TreeSpec JSON.

My honest assessment: **good foundation, probably safe for beta/internal public use, but I would improve validation and release controls before treating it as a stable public contract package.**
