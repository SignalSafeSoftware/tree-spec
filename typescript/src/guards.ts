import type { TreeSpecWire } from "./types.js";

/** Non-null plain object (excludes arrays). */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Minimal structural guard for parsed JSON (same checks as typical API payloads).
 * Does not validate every field; use server validation for authoritative results.
 */
export function isTreeSpecWire(value: unknown): value is TreeSpecWire {
    return (
        typeof value === "object" &&
        value !== null &&
        "nodes" in (value as Record<string, unknown>) &&
        "start_node" in (value as Record<string, unknown>)
    );
}
