/**
 * @packageDocumentation
 * Generic TreeSpec wire format + authoring graph model.
 * No React, simulator runtime, or transport — consumers add those layers.
 */

export {
    END_NODE_ID,
    LEGACY_END_NODE_ID,
    TERMINAL_OUTCOME,
    TREE_SPEC_ISSUE_SEVERITY,
    TREESPEC_WIRE_VERSION,
} from "./constants.js";

export type {
    TerminalOutcome,
    TreeGraph,
    TreeGraphChoice,
    TreeGraphNode,
    TreeGraphTransition,
    TreeSpecIssue,
    TreeSpecIssueSeverity,
    TreeSpecNodeWire,
    TreeSpecTransitionWire,
    TreeSpecWire,
} from "./types.js";

export { compileTreeSpec, decompileTreeSpec } from "./compile.js";

export { lintTreeSpecWire } from "./lint.js";

export { isRecord, isTreeSpecWire } from "./guards.js";

export { safeUUID } from "./randomId.js";

export {
    GRAPH_EDITOR_META_NS,
    readGraphEditorMeta,
    writeGraphEditorMeta,
} from "./graphEditorMeta.js";
export type {
    GraphEditorEdgeType,
    GraphEditorMeta,
    GraphEditorViewport,
} from "./graphEditorMeta.js";
