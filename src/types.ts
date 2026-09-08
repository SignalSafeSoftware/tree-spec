import type { TERMINAL_OUTCOME, TREE_SPEC_ISSUE_SEVERITY } from "./constants.js";

/**
 * Outcome label when a transition targets the terminal node.
 * Domain products may map these to scores, analytics buckets, etc.
 *
 * Derived from {@link TERMINAL_OUTCOME} so the runtime constant and the
 * static type stay in lockstep.
 */
export type TerminalOutcome = (typeof TERMINAL_OUTCOME)[keyof typeof TERMINAL_OUTCOME];

/** Severity value for {@link TreeSpecIssue}; derived from {@link TREE_SPEC_ISSUE_SEVERITY}. */
export type TreeSpecIssueSeverity = (typeof TREE_SPEC_ISSUE_SEVERITY)[keyof typeof TREE_SPEC_ISSUE_SEVERITY];

/** Stable diagnostic identifiers emitted by the strict decoder and graph linter. */
export type TreeSpecIssueCode =
    | "invalid_root"
    | "invalid_field_type"
    | "invalid_field_value"
    | "unsupported_wire_version"
    | "start_node_not_found"
    | "node_without_choices"
    | "duplicate_choice_id"
    | "duplicate_transition_source"
    | "transition_node_not_found"
    | "transition_choice_not_found"
    | "transition_target_not_found"
    | "missing_choice_transition"
    | "missing_terminal_outcome"
    | "unexpected_nonterminal_outcome"
    | "unreachable_node"
    | "no_terminal_path";

/** A JSON path segment used to locate a validation diagnostic. */
export type TreeSpecIssuePath = readonly (string | number)[];

/** Single user-visible choice on a node. */
export type TreeGraphChoice = {
    id: string;
    label: string;
    /** Canvas-only hints (e.g. edge appearance under `editor`). */
    render_hints?: Record<string, unknown>;
    /** Optional micro-feedback on the choice (wire `choices[].feedback`). */
    feedback?: unknown;
};

/**
 * Authoring graph node (prompt / interaction step).
 *
 * `position` is an editor-side cache mirrored to the wire under
 * `render_hints.editor.graph_position` when compiled. Runtime consumers
 * should read presentation from `render_hints.theme`; editor chrome from
 * `render_hints.editor`.
 */
export type TreeGraphNode = {
    id: string;
    type: string;
    prompt: string;
    render_hints?: Record<string, unknown>;
    choices: TreeGraphChoice[];
    position?: { x: number; y: number };
};

/** Directed edge from (node, choice) to a target node id or {@link END_NODE_ID}. */
export type TreeGraphTransition = {
    id: string;
    fromNodeId: string;
    fromChoiceId: string;
    toNodeId: string;
    outcome?: TerminalOutcome;
    /** Optional micro-feedback on the transition (overrides choice feedback at runtime). */
    feedback?: unknown;
    /** Optional score delta payload (wire `transitions[].delta`). */
    delta?: unknown;
    /** Optional lesson triggers (wire `transitions[].lessons_triggered`). */
    lessons_triggered?: unknown;
};

/**
 * Canonical graph model for editing: nodes + transitions + optional extension slots.
 */
export type TreeGraph = {
    start_node: string;
    nodes: Record<string, TreeGraphNode>;
    transitions: TreeGraphTransition[];
    _ab?: unknown;
    _meta?: Record<string, unknown>;
};

/** Wire shape for a single node (JSON `tree_spec.nodes[id]`). */
export type TreeSpecNodeWire = {
    type?: string;
    prompt?: string;
    render_hints?: Record<string, unknown>;
    choices?: Array<{ id: string; label: string; render_hints?: Record<string, unknown>; feedback?: unknown }>;
    options?: Array<{ id: string; label: string; feedback?: unknown }>;
};

/** Wire shape for a single transition. */
export type TreeSpecTransitionWire = {
    from: [string, string];
    to: string;
    outcome?: TerminalOutcome;
    delta?: unknown;
    feedback?: unknown;
    lessons_triggered?: unknown;
};

/**
 * Serialized tree specification (e.g. API `tree_spec` JSON).
 * Extension fields should live under `_meta` where possible.
 *
 * `wire_version` is optional: omitted means implicit v1 (see `TREESPEC_WIRE_VERSION`).
 * When present, it must equal `TREESPEC_WIRE_VERSION` or consumers should reject the payload.
 */
export type TreeSpecWire = {
    /** Optional wire-format revision; must match `TREESPEC_WIRE_VERSION` when set. */
    wire_version?: number;
    start_node: string;
    nodes: Record<string, TreeSpecNodeWire>;
    transitions: TreeSpecTransitionWire[];
    _ab?: unknown;
    _meta?: Record<string, unknown>;
};

/** Structural validation issue for a tree_spec payload. */
export type TreeSpecIssue = {
    severity: TreeSpecIssueSeverity;
    message: string;
    /** Stable machine-readable identifier when produced by strict validation. */
    code?: TreeSpecIssueCode;
    /** JSON path into the decoded document when available. */
    path?: TreeSpecIssuePath;
    node_id?: string;
    choice_id?: string;
};

/** Result returned by {@link parseTreeSpecWire} for untrusted JSON input. */
export type TreeSpecValidationResult = {
    value: TreeSpecWire | null;
    issues: readonly TreeSpecIssue[];
};
