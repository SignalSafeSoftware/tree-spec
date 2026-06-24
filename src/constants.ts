/** Canonical id for the terminal node in the wire format. */
export const END_NODE_ID = "END" as const;

/** Legacy alias seen in older payloads; normalized to {@link END_NODE_ID} on read. */
export const LEGACY_END_NODE_ID = "__END__" as const;

/** Wire-format revision for interoperability (bump when the JSON shape changes). */
export const TREESPEC_WIRE_VERSION = 1 as const;

/**
 * Canonical terminal outcome values for transitions targeting `END_NODE_ID`.
 * Use these constants instead of bare string literals so consumers cannot drift.
 */
export const TERMINAL_OUTCOME = {
    SAFE: "safe",
    AT_RISK: "at_risk",
    COMPROMISED: "compromised",
} as const;

/**
 * Canonical severity values for `TreeSpecIssue`. Lint helpers and editor UIs
 * should reference these instead of inlining `"error" | "warning" | "info"`.
 */
export const TREE_SPEC_ISSUE_SEVERITY = {
    ERROR: "error",
    WARNING: "warning",
    INFO: "info",
} as const;
