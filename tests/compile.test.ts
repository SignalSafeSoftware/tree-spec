import { describe, expect, it, vi } from "vitest";
import {
    END_NODE_ID,
    LEGACY_END_NODE_ID,
    TREESPEC_WIRE_VERSION,
} from "../src/constants";
import { compileTreeSpec, decompileTreeSpec } from "../src/compile";
import { readGraphPosition } from "../src/renderHintsEditor";
import type { TreeGraph, TreeSpecWire } from "../src/types";

describe("compile / decompile", () => {
    it("round-trips a minimal graph", () => {
        const wire: TreeSpecWire = {
            start_node: "n1",
            nodes: {
                n1: {
                    type: "prompt",
                    prompt: "Hello",
                    choices: [{ id: "c1", label: "Go" }],
                },
            },
            transitions: [
                { from: ["n1", "c1"], to: END_NODE_ID, outcome: "at_risk" },
            ],
        };
        const graph = decompileTreeSpec(wire);
        const back = compileTreeSpec(graph);
        expect(back.start_node).toBe(wire.start_node);
        expect(Object.keys(back.nodes)).toEqual(["n1"]);
        expect(back.transitions).toHaveLength(1);
        expect(back.transitions[0]?.outcome).toBe("at_risk");
    });

    it("round-trips transition feedback on wire transitions", () => {
        const wire: TreeSpecWire = {
            start_node: "n1",
            nodes: {
                n1: {
                    type: "prompt",
                    prompt: "Pick",
                    choices: [{ id: "go", label: "Go" }],
                },
                n2: {
                    type: "prompt",
                    prompt: "Next",
                    choices: [{ id: "end", label: "End" }],
                },
            },
            transitions: [
                {
                    from: ["n1", "go"],
                    to: "n2",
                    feedback: {
                        key: "mid-fb",
                        title: "Mid path",
                        takeaway: "Keep going",
                    },
                },
                {
                    from: ["n2", "end"],
                    to: END_NODE_ID,
                    outcome: "safe",
                    feedback: {
                        key: "end-fb",
                        title: "Finished",
                    },
                },
            ],
        };

        const graph = decompileTreeSpec(wire);
        expect(graph.transitions[0]?.feedback).toMatchObject({
            key: "mid-fb",
            title: "Mid path",
        });
        expect(graph.transitions[1]?.feedback).toMatchObject({
            key: "end-fb",
            title: "Finished",
        });

        const back = compileTreeSpec(graph);
        expect(back.transitions[0]?.feedback).toMatchObject({
            key: "mid-fb",
            title: "Mid path",
            takeaway: "Keep going",
        });
        expect(back.transitions[1]?.feedback).toMatchObject({
            key: "end-fb",
            title: "Finished",
        });
    });

    it("round-trips choice feedback on wire choices", () => {
        const wire: TreeSpecWire = {
            start_node: "n1",
            nodes: {
                n1: {
                    type: "prompt",
                    prompt: "Hello",
                    choices: [
                        {
                            id: "c1",
                            label: "Go",
                            feedback: {
                                key: "choice-fb",
                                title: "Choice feedback",
                            },
                        },
                    ],
                },
            },
            transitions: [
                { from: ["n1", "c1"], to: END_NODE_ID, outcome: "at_risk" },
            ],
        };

        const graph = decompileTreeSpec(wire);
        expect(graph.nodes.n1?.choices[0]?.feedback).toMatchObject({
            key: "choice-fb",
            title: "Choice feedback",
        });

        const back = compileTreeSpec(graph);
        expect(back.nodes.n1?.choices?.[0]?.feedback).toMatchObject({
            key: "choice-fb",
            title: "Choice feedback",
        });
    });

    it("round-trips transition delta and lessons_triggered", () => {
        const wire: TreeSpecWire = {
            start_node: "n1",
            nodes: {
                n1: {
                    type: "prompt",
                    prompt: "Hello",
                    choices: [{ id: "c1", label: "Go" }],
                },
            },
            transitions: [
                {
                    from: ["n1", "c1"],
                    to: END_NODE_ID,
                    outcome: "safe",
                    delta: { score: 10 },
                    lessons_triggered: ["lesson-a"],
                },
            ],
        };

        const back = compileTreeSpec(decompileTreeSpec(wire));
        expect(back.transitions[0]).toMatchObject({
            delta: { score: 10 },
            lessons_triggered: ["lesson-a"],
        });
    });

    it("preserves _meta extension slot", () => {
        const graph: TreeGraph = {
            start_node: "n1",
            nodes: {
                n1: {
                    id: "n1",
                    type: "prompt",
                    prompt: "x",
                    choices: [],
                },
            },
            transitions: [],
            _meta: { custom: true },
        };
        const w = compileTreeSpec(graph);
        expect(w._meta).toEqual({ custom: true });
        expect(decompileTreeSpec(w)._meta).toEqual({ custom: true });
    });

    it("normalizes legacy END tokens and options during decompile", () => {
        const wire: TreeSpecWire = {
            start_node: "n1",
            nodes: {
                n1: {
                    options: [{ id: "c1", label: "Legacy option" }],
                },
            },
            transitions: [
                { from: ["n1", "c1"], to: LEGACY_END_NODE_ID, outcome: "safe" },
            ],
            _ab: { enabled: true },
        };

        const graph = decompileTreeSpec(wire);
        expect(graph.nodes.n1?.choices).toEqual([
            { id: "c1", label: "Legacy option" },
        ]);
        expect(graph.transitions[0]?.toNodeId).toBe(END_NODE_ID);
        expect(graph._ab).toEqual({ enabled: true });
    });

    it("filters incomplete transitions and defaults terminal outcome to at_risk", () => {
        const graph: TreeGraph = {
            start_node: "n1",
            nodes: {
                n1: {
                    id: "n1",
                    type: "prompt",
                    prompt: "Hello",
                    choices: [{ id: "c1", label: "Go" }],
                },
                n2: { id: "n2", type: "prompt", prompt: "Next", choices: [] },
            },
            transitions: [
                {
                    id: "t1",
                    fromNodeId: "n1",
                    fromChoiceId: "c1",
                    toNodeId: LEGACY_END_NODE_ID,
                },
                {
                    id: "t2",
                    fromNodeId: "n1",
                    fromChoiceId: "c1",
                    toNodeId: "",
                },
                {
                    id: "t3",
                    fromNodeId: "n1",
                    fromChoiceId: "c1",
                    toNodeId: "n2",
                    outcome: "safe",
                },
            ],
        };

        const wire = compileTreeSpec(graph);
        expect(wire.transitions).toHaveLength(2);
        expect(wire.transitions[0]).toEqual({
            from: ["n1", "c1"],
            to: END_NODE_ID,
            outcome: "at_risk",
        });
        expect(wire.transitions[1]).toEqual({
            from: ["n1", "c1"],
            to: "n2",
        });
    });

    it("falls back when randomUUID is unavailable and normalizes default node values", () => {
        vi.stubGlobal("crypto", {
            getRandomValues(arr: Uint8Array) {
                arr.fill(1);
                return arr;
            },
        });

        const graph = decompileTreeSpec({
            start_node: "start",
            nodes: {
                start: {
                    render_hints: "invalid" as unknown as Record<
                        string,
                        unknown
                    >,
                },
            },
            transitions: [{ from: ["start", "c1"], to: "" }],
        } as unknown as TreeSpecWire);

        expect(graph.nodes.start).toEqual({
            id: "start",
            type: "prompt",
            prompt: "",
            render_hints: {},
            choices: [],
        });
        expect(graph.transitions[0]?.id).toContain("-");
        expect(graph.transitions[0]?.fromChoiceId).toBe("c1");

        vi.unstubAllGlobals();
    });

    it("handles missing nodes or transitions in loose runtime payloads", () => {
        const graph = decompileTreeSpec({
            start_node: "start",
        } as unknown as TreeSpecWire);

        expect(graph.nodes).toEqual({});
        expect(graph.transitions).toEqual([]);
    });

    it("defaults missing transition source and target fields in loose runtime payloads", () => {
        const graph = decompileTreeSpec({
            start_node: "start",
            nodes: {},
            transitions: [{}],
        } as unknown as TreeSpecWire);

        expect(graph.transitions[0]).toMatchObject({
            fromNodeId: "",
            fromChoiceId: "",
            toNodeId: "",
            outcome: undefined,
        });
    });

    it("round-trips choice render_hints on wire choices", () => {
        const graph: TreeGraph = {
            start_node: "n1",
            nodes: {
                n1: {
                    id: "n1",
                    type: "prompt",
                    prompt: "Hello",
                    choices: [
                        {
                            id: "verify",
                            label: "Verify",
                            render_hints: {
                                editor: {
                                    showLabel: false,
                                    strokeColor: "#0d6efd",
                                    edgeType: "smoothstep",
                                },
                            },
                        },
                    ],
                },
            },
            transitions: [],
        };

        const wire = compileTreeSpec(graph);
        expect(wire.nodes.n1?.choices?.[0]?.render_hints).toMatchObject({
            editor: {
                showLabel: false,
                strokeColor: "#0d6efd",
                edgeType: "smoothstep",
            },
        });

        const roundTripped = decompileTreeSpec(wire);
        expect(roundTripped.nodes.n1?.choices[0]?.render_hints).toMatchObject({
            editor: {
                showLabel: false,
                strokeColor: "#0d6efd",
                edgeType: "smoothstep",
            },
        });
    });

    it("round-trips graph position via render_hints.editor.graph_position", () => {
        const graph: TreeGraph = {
            start_node: "n1",
            nodes: {
                n1: {
                    id: "n1",
                    type: "prompt",
                    prompt: "Hello",
                    choices: [],
                    position: { x: 120, y: 240 },
                    render_hints: { layout: "callout" },
                },
            },
            transitions: [],
        };

        const wire = compileTreeSpec(graph);
        expect(wire.nodes.n1?.render_hints).toMatchObject({
            layout: "callout",
            editor: { graph_position: { x: 120, y: 240 } },
        });

        const roundTripped = decompileTreeSpec(wire);
        expect(roundTripped.nodes.n1?.position).toEqual({ x: 120, y: 240 });
        expect(roundTripped.nodes.n1?.render_hints?.layout).toBe("callout");
    });

    it("round-trips graph editor meta via _meta.graph_editor", () => {
        const graph: TreeGraph = {
            start_node: "n1",
            nodes: {
                n1: {
                    id: "n1",
                    type: "prompt",
                    prompt: "Hello",
                    choices: [],
                    position: { x: 120, y: 240 },
                },
            },
            transitions: [],
            _meta: {
                graph_editor: {
                    end_position: { x: 900, y: 100 },
                    viewport: { x: -20, y: 10, zoom: 0.9 },
                },
            },
        };

        const wire = compileTreeSpec(graph);
        expect(wire._meta).toMatchObject({
            graph_editor: {
                end_position: { x: 900, y: 100 },
                viewport: { x: -20, y: 10, zoom: 0.9 },
            },
        });

        const roundTripped = decompileTreeSpec(wire);
        expect(roundTripped._meta).toMatchObject({
            graph_editor: {
                end_position: { x: 900, y: 100 },
                viewport: { x: -20, y: 10, zoom: 0.9 },
            },
        });
    });

    it("preserves wire graph_position when authoring position is absent", () => {
        const wire: TreeSpecWire = {
            start_node: "n1",
            nodes: {
                n1: {
                    type: "prompt",
                    prompt: "Hello",
                    choices: [],
                    render_hints: {
                        editor: { graph_position: { x: 50, y: 75 } },
                    },
                },
            },
            transitions: [],
        };

        const graph = decompileTreeSpec(wire);
        expect(graph.nodes.n1?.position).toEqual({ x: 50, y: 75 });

        const back = compileTreeSpec({
            ...graph,
            nodes: {
                n1: {
                    ...graph.nodes.n1!,
                    position: undefined,
                },
            },
        });
        expect(readGraphPosition(back.nodes.n1?.render_hints)).toEqual({
            x: 50,
            y: 75,
        });
    });

    it("exposes stable public exports through the package barrel", async () => {
        const treeSpec = await import("../src/index");

        expect(treeSpec.TREESPEC_WIRE_VERSION).toBe(TREESPEC_WIRE_VERSION);
        expect(treeSpec.END_NODE_ID).toBe(END_NODE_ID);
        expect(typeof treeSpec.compileTreeSpec).toBe("function");
        expect(typeof treeSpec.decompileTreeSpec).toBe("function");
        expect(typeof treeSpec.lintTreeSpecWire).toBe("function");
        expect(typeof treeSpec.isTreeSpecWire).toBe("function");
    });
});
