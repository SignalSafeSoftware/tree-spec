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
const graph = decompileTreeSpec(wire);
const roundTrip = compileTreeSpec(graph);

// Lint the recompiled payload to confirm the round-trip stays structurally valid.
const issues = lintTreeSpecWire(roundTrip);

// Expected output:
// [ { id: "inspect", label: "Inspect sender" } ]
console.log(graph.nodes.start?.choices);

// Expected output:
// [ { from: ["start", "inspect"], to: "END", outcome: "safe" } ]
console.log(roundTrip.transitions);

// Expected output:
// []
console.log(issues);
