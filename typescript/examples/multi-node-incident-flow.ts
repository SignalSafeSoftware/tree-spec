import {
    END_NODE_ID,
    compileTreeSpec,
    decompileTreeSpec,
    lintTreeSpecWire,
    type TreeGraph,
    type TreeSpecWire,
} from "@signalsafe/tree-spec";

// Richer authoring graph example: multiple nodes, multiple END outcomes, metadata, and render hints.
export const multiNodeIncidentGraph: TreeGraph = {
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

// Compile to the wire format a host app or API would typically store or send.
export const multiNodeIncidentWire: TreeSpecWire = compileTreeSpec(
    multiNodeIncidentGraph,
);

// Lint the compiled payload to confirm the transitions and terminal outcomes are valid.
export const multiNodeIncidentIssues = lintTreeSpecWire(multiNodeIncidentWire);

// Decompile again to show the graph survives a round-trip through the wire shape.
export const multiNodeIncidentRoundTrip = decompileTreeSpec(
    multiNodeIncidentWire,
);

// Expected output:
// [
//     { from: ["triage", "investigate"], to: "investigate" },
//     { from: ["triage", "dismiss"], to: "END", outcome: "compromised" },
//     { from: ["investigate", "escalate"], to: "recovery" },
//     { from: ["investigate", "reimage"], to: "END", outcome: "at_risk" },
//     { from: ["recovery", "close"], to: "END", outcome: "safe" }
// ]
console.log(multiNodeIncidentWire.transitions);

// Expected output:
// []
console.log(multiNodeIncidentIssues);

// Expected output:
// ["triage", "investigate", "recovery"]
console.log(Object.keys(multiNodeIncidentRoundTrip.nodes));
