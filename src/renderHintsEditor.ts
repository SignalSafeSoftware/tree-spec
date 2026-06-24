import { isRecord } from "./guards.js";

/** Namespace for graph-editor-only keys inside `render_hints`. */
export const RENDER_HINTS_EDITOR_NS = "editor";

/** Wire key for canvas coordinates under `render_hints.editor`. */
export const GRAPH_POSITION_KEY = "graph_position";

export type GraphPosition = { x: number; y: number };

/** Read canvas position from `render_hints.editor.graph_position`. */
export function readGraphPosition(
    hints: Record<string, unknown> | undefined,
): GraphPosition | undefined {
    if (!hints || !isRecord(hints)) return undefined;
    const editor = hints[RENDER_HINTS_EDITOR_NS];
    if (!isRecord(editor)) return undefined;
    const gp = editor[GRAPH_POSITION_KEY];
    if (!isRecord(gp)) return undefined;
    const x = gp.x;
    const y = gp.y;
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

/** Merge canvas position into `render_hints.editor` without clobbering other keys. */
export function writeGraphPosition(
    hints: Record<string, unknown> | undefined,
    position: GraphPosition | undefined,
): Record<string, unknown> {
    const next = hints ? { ...hints } : {};
    const existingEditor = next[RENDER_HINTS_EDITOR_NS];
    const editor: Record<string, unknown> = isRecord(existingEditor)
        ? { ...existingEditor }
        : {};

    if (
        position &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y)
    ) {
        editor[GRAPH_POSITION_KEY] = { x: position.x, y: position.y };
    } else {
        delete editor[GRAPH_POSITION_KEY];
    }

    if (Object.keys(editor).length > 0) {
        next[RENDER_HINTS_EDITOR_NS] = editor;
    } else {
        delete next[RENDER_HINTS_EDITOR_NS];
    }

    return next;
}
