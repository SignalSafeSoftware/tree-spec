import { describe, expect, it } from "vitest";
import { compileTreeSpec, decompileTreeSpec } from "../src/compile.js";
import { parseTreeSpecWire } from "../src/parse.js";
import { readGraphEditorMeta, writeGraphEditorMeta } from "../src/graphEditorMeta.js";

function validWire() {
    return { start_node: "start", nodes: { start: { type: "decision", prompt: "Choose", choices: [{ id: "go", label: "Go" }] } }, transitions: [{ from: ["start", "go"], to: "END", outcome: "safe" }] };
}

describe("audit regression boundaries", () => {
    it("handles deeply nested JSON without throwing and preserves shared references", () => {
        let delta: object = { shared: true };
        for (let i = 0; i < 20000; i++) delta = { nested: delta };
        const wire = validWire();
        const result = parseTreeSpecWire({ ...wire, transitions: [{ ...wire.transitions[0], delta }] });
        expect(result.issues).toEqual([]);
        expect(result.value?.transitions[0]?.delta).toBe(delta);
        const shared = { value: [1, null] };
        expect(parseTreeSpecWire({ ...wire, _meta: { left: shared, right: shared } }).issues).toEqual([]);
    });

    it("rejects deeply nested cycles with ordinary validation diagnostics", () => {
        const cycle: Record<string, object> = {};
        cycle.self = cycle;
        let delta: object = cycle;
        for (let i = 0; i < 20000; i++) delta = { nested: delta };
        const wire = validWire();
        const result = parseTreeSpecWire({ ...wire, transitions: [{ ...wire.transitions[0], delta }] });
        expect(result.value).toBeNull();
        expect(result.issues).toContainEqual(expect.objectContaining({ code: "invalid_field_type", path: ["tree_spec", "transitions", 0, "delta"] }));
    });

    it("preserves prototype-like node IDs through parsing and graph round trips", () => {
        for (const id of ["__proto__", "constructor", "toString"]) {
            const wire = validWire();
            const input = { ...wire, start_node: id, nodes: Object.fromEntries([[id, wire.nodes.start]]), transitions: [{ ...wire.transitions[0], from: [id, "go"] }] };
            const result = parseTreeSpecWire(input);
            expect(result.issues).toEqual([]);
            if (result.value === null) throw new Error("Expected a valid prototype-like node");
            const graph = decompileTreeSpec(result.value);
            const compiled = compileTreeSpec(graph);
            expect(Object.keys(graph.nodes)).toEqual([id]);
            expect(Object.keys(compiled.nodes)).toEqual([id]);
            expect(Object.getPrototypeOf(compiled.nodes)).toBe(Object.prototype);
            expect(parseTreeSpecWire(compiled).issues).toEqual([]);
        }
    });

    it("retains unknown editor keys while updating and clearing owned fields", () => {
        const custom = { preserve: true };
        const meta = { graph_editor: { custom, end_position: { x: 1, y: 2 }, viewport: { x: 0, y: 0, zoom: 1 } }, outer: true };
        const updated = writeGraphEditorMeta(meta, { end_position: { x: 3, y: 4 } });
        expect(updated.graph_editor).toEqual({ custom, end_position: { x: 3, y: 4 }, viewport: { x: 0, y: 0, zoom: 1 } });
        const cleared = writeGraphEditorMeta(updated, { end_position: undefined, viewport: undefined });
        expect(cleared).toEqual({ graph_editor: { custom }, outer: true });
        expect(meta.graph_editor.end_position).toEqual({ x: 1, y: 2 });
    });

    it("reads each editor field once", () => {
        let reads = 0;
        const bucket = { get end_position() { reads++; return { x: 1, y: 2 }; }, get viewport() { reads++; return { x: 0, y: 0, zoom: 1 }; }, get default_edge_type() { reads++; return "step"; } };
        expect(readGraphEditorMeta({ graph_editor: bucket })).toEqual({ end_position: { x: 1, y: 2 }, viewport: { x: 0, y: 0, zoom: 1 }, default_edge_type: "step" });
        expect(reads).toBe(3);
    });
});
