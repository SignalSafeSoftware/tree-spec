import {
    END_NODE_ID,
    TREESPEC_WIRE_VERSION,
    lintTreeSpecWire,
    type TreeSpecWire,
} from "@signalsafe/tree-spec";

// Single-node branching example: the choice determines which terminal outcome is reached.
export const branchingOutcomesWire: TreeSpecWire = {
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

// A valid branching wire should lint with zero issues.
const issues = lintTreeSpecWire(branchingOutcomesWire);

// Expected output:
// []
console.log(issues);
