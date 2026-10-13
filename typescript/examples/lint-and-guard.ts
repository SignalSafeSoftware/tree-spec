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
    throw new Error(
        "Expected the payload to satisfy the minimal TreeSpec guard.",
    );
}

// Linting performs the deeper structural checks, including END/outcome rules.
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
