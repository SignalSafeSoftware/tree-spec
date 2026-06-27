# `@signalsafe/tree-spec`

Generic **TreeSpec** wire format (`TreeSpecWire`), authoring graph model (`TreeGraph`), and **compile / decompile / lint** helpers.

| | |
|---|---|
| **npm** | `@signalsafe/tree-spec` |
| **GitHub** | [SignalSafeSoftware/tree-spec](https://github.com/SignalSafeSoftware/tree-spec) |

## What this package does

- Define the **TreeSpec wire JSON contract** (types, constants, guards).
- **Compile / decompile** between wire JSON and an authoring graph (`TreeGraph`).
- **Lint** wire payloads (`lintTreeSpecWire`) and normalize legacy shapes (`options`, legacy END ids).
- Read/write **graph-editor metadata** namespaces (`readGraphEditorMeta`, `writeGraphEditorMeta`).

## What this package does not do

- Scenario simulation, scoring sessions, or learner UI — use `@signalsafe/simulator-core` / `@signalsafe/simulator-react`.
- Graph editor UI — use `@signalsafe/tree-spec-editor-*`.
- HTTP, auth, persistence, or sandboxing — contract validation only; hosts decide trust and access control.

## Install

```bash
npm install @signalsafe/tree-spec
```

For TypeScript consumers, use a normal modern ESM setup such as `module: "NodeNext"` and `moduleResolution: "NodeNext"` (or the equivalent bundler-compatible settings in your toolchain). The package ships built ESM + declarations in `dist/`.

All README examples are strictly typed and are checked by `yarn typecheck`, which also runs `tsc --noEmit -p tsconfig.examples.json` for the example files.

## Repository

Source code and issues are available at:
https://github.com/SignalSafeSoftware/tree-spec

## Quick start

```ts
import {
    END_NODE_ID,
    TREESPEC_WIRE_VERSION,
    compileTreeSpec,
    decompileTreeSpec,
    lintTreeSpecWire,
    type TreeSpecWire,
} from "@signalsafe/tree-spec";

// Minimal modern wire payload: one prompt, one choice, one terminal outcome.
const wire: TreeSpecWire = {
    wire_version: TREESPEC_WIRE_VERSION,
    start_node: "start",
    nodes: {
        start: {
            type: "prompt",
            prompt: "Inspect the sender details before clicking?",
            choices: [{ id: "inspect", label: "Inspect sender" }],
        },
    },
    transitions: [
        { from: ["start", "inspect"], to: END_NODE_ID, outcome: "safe" },
    ],
};

// Decompile to the authoring graph shape, then compile back to wire JSON.
const tree = decompileTreeSpec(wire);
const roundTrip = compileTreeSpec(tree);

// Lint the recompiled payload to confirm the round-trip stays structurally valid.
const issues = lintTreeSpecWire(roundTrip);

// Expected output:
// [ { id: "inspect", label: "Inspect sender" } ]
console.log(tree.nodes.start?.choices);

// Expected output:
// [ { from: ["start", "inspect"], to: "END", outcome: "safe" } ]
console.log(roundTrip.transitions);

// Expected output:
// []
console.log(issues);
```

## Examples

### Guard and lint an unknown payload

```ts
import {
    END_NODE_ID,
    LEGACY_END_NODE_ID,
    TREESPEC_WIRE_VERSION,
    isTreeSpecWire,
    lintTreeSpecWire,
} from "@signalsafe/tree-spec";

// Treat the payload as unknown first to demonstrate the lightweight runtime guard.
const raw: unknown = {
    wire_version: TREESPEC_WIRE_VERSION,
    start_node: "start",
    nodes: {
        start: {
            options: [{ id: "continue", label: "Continue" }],
        },
    },
    transitions: [
        {
            from: ["start", "continue"],
            to: LEGACY_END_NODE_ID,
            outcome: "safe",
        },
    ],
};

// The guard only checks for the basic TreeSpec-shaped envelope.
if (!isTreeSpecWire(raw)) {
    throw new Error("Expected a TreeSpec-shaped payload.");
}

const issues = lintTreeSpecWire(raw);
if (issues.length > 0) {
    throw new Error(JSON.stringify(issues));
}

// `LEGACY_END_NODE_ID` is accepted by the linter even though consumers usually normalize to `END`.
// Expected output:
// END
console.log(END_NODE_ID);

// Expected output:
// __END__
console.log(raw.transitions[0]?.to);
```

### Normalize legacy payloads

```ts
import {
    END_NODE_ID,
    LEGACY_END_NODE_ID,
    decompileTreeSpec,
    type TreeSpecWire,
} from "@signalsafe/tree-spec";

const legacyOptionsWire: TreeSpecWire = {
    start_node: "start",
    nodes: {
        start: {
            options: [{ id: "go", label: "Continue" }],
        },
    },
    transitions: [
        { from: ["start", "go"], to: LEGACY_END_NODE_ID, outcome: "safe" },
    ],
};

// Decompile normalizes both legacy `options` and the legacy terminal node id.
const graph = decompileTreeSpec(legacyOptionsWire);

// Expected output:
// [ { id: "go", label: "Continue" } ]
console.log(graph.nodes.start?.choices);

// Expected output:
// true
console.log(graph.transitions[0]?.toNodeId === END_NODE_ID); // true
```

### Basic branching wire

```ts
import {
    END_NODE_ID,
    TREESPEC_WIRE_VERSION,
    lintTreeSpecWire,
    type TreeSpecWire,
} from "@signalsafe/tree-spec";

const branchingWire: TreeSpecWire = {
    wire_version: TREESPEC_WIRE_VERSION,
    start_node: "inbox",
    nodes: {
        inbox: {
            type: "prompt",
            prompt: "A vendor email asks you to update bank details. What do you do first?",
            render_hints: { layout: "two-column" },
            choices: [
                {
                    id: "verify",
                    label: "Verify the request with a trusted contact",
                },
                { id: "reply", label: "Reply directly to the email" },
            ],
        },
    },
    transitions: [
        { from: ["inbox", "verify"], to: END_NODE_ID, outcome: "safe" },
        { from: ["inbox", "reply"], to: END_NODE_ID, outcome: "at_risk" },
    ],
};

const issues = lintTreeSpecWire(branchingWire);

// Expected output:
// []
console.log(issues);
```

### Multi-node authoring graph

```ts
import {
    END_NODE_ID,
    compileTreeSpec,
    decompileTreeSpec,
    lintTreeSpecWire,
    type TreeGraph,
} from "@signalsafe/tree-spec";

const multiNodeGraph: TreeGraph = {
    start_node: "triage",
    nodes: {
        triage: {
            id: "triage",
            type: "prompt",
            prompt: "An employee reports a suspicious attachment. What is the first response?",
            choices: [
                {
                    id: "investigate",
                    label: "Investigate the email headers and isolate the device",
                },
                {
                    id: "dismiss",
                    label: "Assume it is harmless and dismiss the report",
                },
            ],
            render_hints: { layout: "split-panel", priority: "high" },
            position: { x: 80, y: 120 },
        },
        investigate: {
            id: "investigate",
            type: "prompt",
            prompt: "The attachment contacted an unknown host. What do you do next?",
            choices: [
                {
                    id: "escalate",
                    label: "Escalate to incident response and preserve evidence",
                },
                {
                    id: "reimage",
                    label: "Reimage immediately without collecting evidence",
                },
            ],
            render_hints: { layout: "decision-card" },
            position: { x: 420, y: 40 },
        },
        recovery: {
            id: "recovery",
            type: "info",
            prompt: "Notify stakeholders, document the timeline, and restore the endpoint safely.",
            choices: [{ id: "close", label: "Close incident" }],
            render_hints: { layout: "callout", tone: "success" },
            position: { x: 760, y: 40 },
        },
    },
    transitions: [
        {
            id: "t1",
            fromNodeId: "triage",
            fromChoiceId: "investigate",
            toNodeId: "investigate",
        },
        {
            id: "t2",
            fromNodeId: "triage",
            fromChoiceId: "dismiss",
            toNodeId: END_NODE_ID,
            outcome: "compromised",
        },
        {
            id: "t3",
            fromNodeId: "investigate",
            fromChoiceId: "escalate",
            toNodeId: "recovery",
        },
        {
            id: "t4",
            fromNodeId: "investigate",
            fromChoiceId: "reimage",
            toNodeId: END_NODE_ID,
            outcome: "at_risk",
        },
        {
            id: "t5",
            fromNodeId: "recovery",
            fromChoiceId: "close",
            toNodeId: END_NODE_ID,
            outcome: "safe",
        },
    ],
    _meta: {
        template: "incident-response",
        versionLabel: "example-v2",
    },
};

const wire = compileTreeSpec(multiNodeGraph);
const issues = lintTreeSpecWire(wire);
const roundTrip = decompileTreeSpec(wire);

// Expected output:
// [
//     { from: ["triage", "investigate"], to: "investigate" },
//     { from: ["triage", "dismiss"], to: "END", outcome: "compromised" },
//     { from: ["investigate", "escalate"], to: "recovery" },
//     { from: ["investigate", "reimage"], to: "END", outcome: "at_risk" },
//     { from: ["recovery", "close"], to: "END", outcome: "safe" }
// ]
console.log(wire.transitions);

// Expected output:
// []
console.log(issues);

// Expected output:
// ["triage", "investigate", "recovery"]
console.log(Object.keys(roundTrip.nodes));
```

## Graph editor metadata (`render_hints.editor` and `_meta.graph_editor`)

TreeSpec nodes may carry arbitrary keys under `render_hints` for product-specific presentation. The graph editor additionally reads and writes **canvas-only** layout and appearance under documented namespaces. These keys round-trip through `compileTreeSpec` / `decompileTreeSpec` and are safe for draft JSON — runtime simulators and preview UIs should ignore unknown keys unless explicitly documented.

### Per-node canvas hints — `render_hints.editor`

Mirrored from the authoring graph’s `node.position` on compile:

| Key | Type | Purpose |
|-----|------|---------|
| `graph_position` | `{ x, y }` | Canvas coordinates (also stored on `TreeGraphNode.position` in memory) |
| `locked` | `boolean` | When true, node is not draggable and auto-layout skips it |
| `width`, `height` | positive number | Canvas card size in px (`width` defaults to 280 when unset) |
| `textWrap` | `"wrap"` \| `"truncate"` | Long prompt/choice text wrapping on the canvas |
| `backgroundColor`, `foregroundColor` | `#rgb` / `#rrggbb` | Canvas card colors |
| `fontSize`, `fontWeight`, `fontFamily`, `textAlign` | string/number | Canvas typography |

Legacy `render_hints.theme` appearance keys are still read as a **canvas fallback** by `@signalsafe/tree-spec-editor-core` when `render_hints.editor` omits a value. New authoring UIs should write canvas appearance to `editor` only.

Example node on the wire after compile:

```json
{
  "type": "prompt",
  "prompt": "Verify the sender?",
  "choices": [{ "id": "go", "label": "Continue" }],
  "render_hints": {
    "layout": "callout",
    "editor": {
      "graph_position": { "x": 120, "y": 240 },
      "width": 280,
      "textWrap": "wrap",
      "locked": false
    }
  }
}
```

Helpers: `readGraphPosition` / `writeGraphPosition` in this package; `getEditorHints` / `patchEditorHints` in `@signalsafe/tree-spec-editor-core`.

### Tree-level editor chrome — `_meta.graph_editor`

The synthetic **END** node and viewport pan/zoom are not part of `nodes` on the wire. Persist them under `_meta.graph_editor`:

| Key | Type | Purpose |
|-----|------|---------|
| `end_position` | `{ x, y }` | Canvas position of the END node |
| `viewport` | `{ x, y, zoom }` | Last pan/zoom when the draft was saved |

Example:

```json
{
  "start_node": "start",
  "nodes": { "...": "..." },
  "transitions": [],
  "_meta": {
    "graph_editor": {
      "end_position": { "x": 900, "y": 100 },
      "viewport": { "x": -20, "y": 10, "zoom": 0.9 }
    }
  }
}
```

Helpers: `readGraphEditorMeta` / `writeGraphEditorMeta` in this package; `resolveEndNodePosition`, `resolveGraphViewport`, `patchGraphEditorMeta` in `@signalsafe/tree-spec-editor-core`.

The editor linter (`lintEditorTree` in `-core`) emits **warnings** for invalid hex colors, non-positive width/height/font size, bad `textWrap` / `textAlign`, and malformed `_meta.graph_editor` values.

## Micro-feedback (transition and choice)

Wire JSON may attach optional micro-feedback objects to **transitions** and/or **choices** (typically `{ key?, title?, body?, takeaway?, red_flags? }`). `compileTreeSpec` / `decompileTreeSpec` preserve both on round-trip.

| Location | Wire path | Authoring graph |
|----------|-----------|-----------------|
| Transition feedback | `transitions[].feedback` | `TreeGraphTransition.feedback` |
| Choice feedback | `nodes[id].choices[].feedback` | `TreeGraphChoice.feedback` |

At **runtime**, `@signalsafe/simulator-core` resolves feedback with **transition first, then choice** (`resolveFeedbackForTransition`). Compile/decompile does not merge or prioritize — it stores both independently.

Example transition with feedback:

```json
{
  "from": ["start", "verify"],
  "to": "END",
  "outcome": "safe",
  "feedback": {
    "key": "verify-safe",
    "title": "Well done",
    "takeaway": "You verified before acting."
  }
}
```

## Contract notes

- `wire_version` is optional. When omitted, consumers can treat the payload as implicit v1.
- Legacy payloads may use `options` instead of `choices` and `LEGACY_END_NODE_ID` instead of `END_NODE_ID`.
- END transitions must include an `outcome`.

## Monorepo architecture

| Layer | Package / repo | Role |
|-------|----------------|------|
| **TypeScript core (this package)** | `@signalsafe/tree-spec` | Wire format, compile/decompile, lint |
| **Python core** | [`signalsafe-tree-spec`](https://github.com/SignalSafeSoftware/tree-spec-python) (`deliveryplus_tree_spec`) | Backend parity: models, lint, builder, patch |
| **Simulator runtime** | `@signalsafe/simulator-core` | Headless session stepping |
| **Editor stack** | `@signalsafe/tree-spec-editor-core` → `-react` → `-editor` | Authoring UI layers |

Cross-language fixture JSON should stay in sync in your product CI when wire rules change.

## Development

Requires Node.js **>=18** (`engines.node`). CI runs checks, tests, and smoke across Node **18**, **20**, **22**, and **24**; publish uses Node **24**.

```bash
yarn install
yarn build
yarn test
yarn typecheck          # includes tsconfig.examples.json
yarn typecheck:examples
```

## Security

See [SECURITY.md](./SECURITY.md). Parsing and lint enforce the documented wire contract; they do not authenticate users or authorize access to scenarios.

## Changelog and releases

- [CHANGELOG.md](./CHANGELOG.md)
- [RELEASING.md](./RELEASING.md)
