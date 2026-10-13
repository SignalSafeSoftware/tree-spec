import {
    END_NODE_ID,
    compileTreeSpec,
    type TreeGraph,
} from "@signalsafe/tree-spec";

// Authoring-side graph example: includes editor-only positions and non-wire metadata.
export const authoringGraph: TreeGraph = {
    start_node: "triage",
    nodes: {
        triage: {
            id: "triage",
            type: "prompt",
            prompt: "A user reports a suspicious file download. What should happen next?",
            choices: [
                { id: "escalate", label: "Escalate to the security team" },
                { id: "ignore", label: "Ignore the report" },
            ],
            position: { x: 100, y: 80 },
        },
        follow_up: {
            id: "follow_up",
            type: "info",
            prompt: "Collect device details and isolate the endpoint if needed.",
            choices: [],
            render_hints: { layout: "callout" },
            position: { x: 420, y: 80 },
        },
    },
    transitions: [
        {
            id: "t-safe",
            fromNodeId: "triage",
            fromChoiceId: "escalate",
            toNodeId: "follow_up",
        },
        {
            id: "t-risk",
            fromNodeId: "triage",
            fromChoiceId: "ignore",
            toNodeId: END_NODE_ID,
            outcome: "compromised",
        },
    ],
    _meta: { template: "incident-response" },
};

// Compiling strips the graph into the serialized wire shape used by consumers.
const wire = compileTreeSpec(authoringGraph);

// Expected output:
// [
//     { from: ["triage", "escalate"], to: "follow_up" },
//     { from: ["triage", "ignore"], to: "END", outcome: "compromised" }
// ]
console.log(wire.transitions);
