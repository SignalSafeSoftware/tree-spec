/**
 * Unknown-field behavior for TreeSpec wire JSON (see docs/compatibility.md).
 */
import { describe, expect, it } from "vitest";
import { END_NODE_ID } from "../src/constants";
import { compileTreeSpec, decompileTreeSpec } from "../src/compile";
import { isTreeSpecWire } from "../src/guards";
import { lintTreeSpecWire } from "../src/lint";
import type { TreeSpecWire } from "../src/types";

describe("unknown wire fields (TypeScript)", () => {
    it("isTreeSpecWire accepts unknown root keys", () => {
        const raw = {
            start_node: "s",
            nodes: {},
            transitions: [],
            experimental_flag: true,
        };
        expect(isTreeSpecWire(raw)).toBe(true);
    });

    it("lintTreeSpecWire does not report unknown root keys", () => {
        const raw = {
            start_node: "s",
            nodes: {
                s: {
                    type: "prompt",
                    prompt: "Hi",
                    choices: [{ id: "c1", label: "Go", tooltip: "extra" }],
                    legacy_flag: true,
                },
            },
            transitions: [
                {
                    from: ["s", "c1"],
                    to: END_NODE_ID,
                    outcome: "safe",
                    internal_note: "drop me",
                },
            ],
            product_id: "demo",
        } as unknown as TreeSpecWire;

        expect(lintTreeSpecWire(raw)).toHaveLength(0);
    });

    it("compile/decompile drops unknown root and node keys but preserves _meta", () => {
        const wire = {
            start_node: "s",
            nodes: {
                s: {
                    type: "prompt",
                    prompt: "Hi",
                    choices: [],
                    legacy_flag: true,
                },
            },
            transitions: [],
            product_id: "demo",
            _meta: { custom_bucket: { any: "json" } },
        } as unknown as TreeSpecWire;

        const back = compileTreeSpec(decompileTreeSpec(wire));
        expect(back).not.toHaveProperty("product_id");
        expect(back.nodes.s).not.toHaveProperty("legacy_flag");
        expect(back._meta).toEqual({ custom_bucket: { any: "json" } });
    });

    it("compile/decompile preserves opaque render_hints nested keys", () => {
        const wire: TreeSpecWire = {
            start_node: "s",
            nodes: {
                s: {
                    type: "prompt",
                    prompt: "Hi",
                    choices: [],
                    render_hints: {
                        theme: { tone: "info" },
                        vendor_extension: { x: 1 },
                    },
                },
            },
            transitions: [],
        };

        const back = compileTreeSpec(decompileTreeSpec(wire));
        expect(back.nodes.s?.render_hints).toMatchObject({
            theme: { tone: "info" },
            vendor_extension: { x: 1 },
        });
    });

    it("compile/decompile drops unknown choice keys but preserves render_hints and feedback", () => {
        const wire = {
            start_node: "s",
            nodes: {
                s: {
                    type: "prompt",
                    prompt: "Hi",
                    choices: [
                        {
                            id: "c1",
                            label: "Go",
                            tooltip: "drop me",
                            render_hints: { editor: { strokeColor: "#000" } },
                            feedback: { title: "Nice", vendor_tag: "keep-me" },
                        },
                    ],
                },
            },
            transitions: [
                { from: ["s", "c1"], to: END_NODE_ID, outcome: "safe" },
            ],
        } as unknown as TreeSpecWire;

        const back = compileTreeSpec(decompileTreeSpec(wire));
        const choice = back.nodes.s?.choices?.[0] as Record<string, unknown>;
        expect(choice).not.toHaveProperty("tooltip");
        expect(choice.render_hints).toEqual({ editor: { strokeColor: "#000" } });
        expect(choice.feedback).toEqual({ title: "Nice", vendor_tag: "keep-me" });
    });

    it("compile/decompile drops unknown transition keys but preserves known wire fields", () => {
        const wire = {
            start_node: "s",
            nodes: {
                s: {
                    type: "prompt",
                    prompt: "Hi",
                    choices: [{ id: "c1", label: "Go" }],
                },
            },
            transitions: [
                {
                    from: ["s", "c1"],
                    to: END_NODE_ID,
                    outcome: "safe",
                    internal_note: "drop me",
                    feedback: { title: "Done", vendor_tag: "keep-me" },
                    delta: { score: 1 },
                    lessons_triggered: ["lesson-a"],
                },
            ],
        } as unknown as TreeSpecWire;

        const back = compileTreeSpec(decompileTreeSpec(wire));
        const transition = back.transitions[0] as Record<string, unknown>;
        expect(transition).not.toHaveProperty("internal_note");
        expect(transition.feedback).toEqual({ title: "Done", vendor_tag: "keep-me" });
        expect(transition.delta).toEqual({ score: 1 });
        expect(transition.lessons_triggered).toEqual(["lesson-a"]);
    });
});
