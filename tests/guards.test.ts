import { describe, expect, it } from "vitest";
import { isRecord, isTreeSpecWire } from "../src/guards";

describe("isRecord", () => {
    it("accepts plain objects and rejects null, arrays, and primitives", () => {
        expect(isRecord({})).toBe(true);
        expect(isRecord({ nodes: {} })).toBe(true);
        expect(isRecord(null)).toBe(false);
        expect(isRecord(undefined)).toBe(false);
        expect(isRecord([])).toBe(false);
        expect(isRecord("x")).toBe(false);
        expect(isRecord(0)).toBe(false);
    });
});

describe("isTreeSpecWire", () => {
    it("requires nodes and start_node keys", () => {
        expect(isTreeSpecWire({ start_node: "a", nodes: {} })).toBe(true);
        expect(isTreeSpecWire({ nodes: {} })).toBe(false);
        expect(isTreeSpecWire({ start_node: "a" })).toBe(false);
        expect(isTreeSpecWire(null)).toBe(false);
        expect(isTreeSpecWire(["start_node", "nodes"])).toBe(false);
    });
});
