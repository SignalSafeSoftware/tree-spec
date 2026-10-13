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

function parseGraphPosition(value: unknown): GraphPosition | undefined {
    if (!isRecord(value)) return undefined;
    const x = value.x;
    const y = value.y;
    if (
        typeof x !== "number" ||
        typeof y !== "number" ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
    ) {
        return undefined;
    }
    return { x, y };
}

function parseViewport(value: unknown): GraphEditorViewport | undefined {
    if (!isRecord(value)) return undefined;
    const x = value.x;
    const y = value.y;
    const zoom = value.zoom;
    if (
        typeof x !== "number" ||
        typeof y !== "number" ||
        typeof zoom !== "number" ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        !Number.isFinite(zoom) ||
        zoom <= 0
    ) {
        return undefined;
    }
    return { x, y, zoom };
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
    return {
        ...(parseGraphPosition(bucket.end_position)
            ? { end_position: parseGraphPosition(bucket.end_position) }
            : {}),
        ...(parseViewport(bucket.viewport)
            ? { viewport: parseViewport(bucket.viewport) }
            : {}),
        ...(parseEdgeType(bucket.default_edge_type)
            ? { default_edge_type: parseEdgeType(bucket.default_edge_type) }
            : {}),
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

    const bucket: Record<string, unknown> = {};
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
