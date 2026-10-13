import { isRecord } from "./guards.js";
import type { GraphPosition } from "./renderHintsEditor.js";

/** Shared validation for canvas positions in portable editor metadata. */
export function parseGraphPosition(value: unknown): GraphPosition | undefined {
    if (!isRecord(value)) return undefined;
    const x = value.x;
    const y = value.y;
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    return { x, y };
}
