import {
    END_NODE_ID,
    LEGACY_END_NODE_ID,
    decompileTreeSpec,
    type TreeSpecWire,
} from "@signalsafe/tree-spec";

// Legacy wire payloads may use `options` instead of `choices`.
export const legacyOptionsWire: TreeSpecWire = {
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
console.log(graph.transitions[0]?.toNodeId === END_NODE_ID);
