import { parseGraphPosition } from "./graphPosition.js";
import { isRecord } from "./guards.js";
import type { GraphPosition } from "./renderHintsEditor.js";

/** Namespace for graph-editor chrome under `tree_spec._meta`. */
export const GRAPH_EDITOR_META_NS = "graph_editor";

export type GraphEditorViewport = {
    x: number;
    y: number;
    zoom: number;
};

export type GraphEditorEdgeType = 'straight' | 'smoothstep' | 'step';

export type GraphEditorMeta = {
    end_position?: GraphPosition;
    viewport?: GraphEditorViewport;
    /** Canvas default when a choice omits `render_hints.editor.edgeType`. */
    default_edge_type?: GraphEditorEdgeType;
};

function parseViewport(value: unknown): GraphEditorViewport | undefined {
    if (!isRecord(value)) return undefined;
    const position = parseGraphPosition(value);
    const zoom = value.zoom;
    if (position === undefined || typeof zoom !== "number" || !Number.isFinite(zoom) || zoom <= 0) return undefined;
    return { ...position, zoom };
}

function parseEdgeType(value: unknown): GraphEditorEdgeType | undefined {
    if (value === 'straight' || value === 'smoothstep' || value === 'step') {
        return value;
    }
    return undefined;
}

/** Read canvas-only editor state from `_meta.graph_editor`. */
export function readGraphEditorMeta(
    meta: Record<string, unknown> | undefined,
): GraphEditorMeta {
    if (!meta || !isRecord(meta)) return {};
    const bucket = meta[GRAPH_EDITOR_META_NS];
    if (!isRecord(bucket)) return {};
    const endPosition = parseGraphPosition(bucket.end_position);
    const viewport = parseViewport(bucket.viewport);
    const edgeType = parseEdgeType(bucket.default_edge_type);
    return {
        ...(endPosition === undefined ? {} : { end_position: endPosition }),
        ...(viewport === undefined ? {} : { viewport }),
        ...(edgeType === undefined ? {} : { default_edge_type: edgeType }),
    };
}

/** Merge canvas-only editor state into `_meta.graph_editor`. */
export function writeGraphEditorMeta(
    meta: Record<string, unknown> | undefined,
    patch: Partial<GraphEditorMeta>,
): Record<string, unknown> {
    const next = meta ? { ...meta } : {};
    const current = readGraphEditorMeta(next);
    const merged: GraphEditorMeta = { ...current, ...patch };

    const existing = next[GRAPH_EDITOR_META_NS];
    const bucket: Record<string, unknown> = isRecord(existing) ? { ...existing } : {};
    delete bucket.end_position;
    delete bucket.viewport;
    delete bucket.default_edge_type;
    if (merged.end_position) {
        bucket.end_position = merged.end_position;
    }
    if (merged.viewport) {
        bucket.viewport = merged.viewport;
    }
    if (merged.default_edge_type) {
        bucket.default_edge_type = merged.default_edge_type;
    }

    if (Object.keys(bucket).length > 0) {
        next[GRAPH_EDITOR_META_NS] = bucket;
    } else {
        delete next[GRAPH_EDITOR_META_NS];
    }

    return next;
}
