import { describe, expect, it } from "vitest";
import { parseTreeSpecWire } from "../src/parse";

describe("parser issue anchors", () => {
    it("attaches node and choice IDs to malformed node and choice fields", () => {
        const result = parseTreeSpecWire({
            start_node: "start",
            nodes: {
                start: {
                    type: 7,
                    prompt: "Choose",
                    render_hints: [],
                    choices: [
                        null,
                        { id: "go", label: "Go", render_hints: [], feedback: Number.NaN },
                        { id: 5, label: "" },
                    ],
                },
            },
            transitions: [],
        });

        const byPath = (path: string) =>
            result.issues.find((issue) => issue.path?.join(".") === path);
        expect(byPath("tree_spec.nodes.start.type")?.node_id).toBe("start");
        expect(byPath("tree_spec.nodes.start.render_hints")?.node_id).toBe("start");
        expect(byPath("tree_spec.nodes.start.choices.0")).toMatchObject({ node_id: "start" });
        expect(byPath("tree_spec.nodes.start.choices.0")?.choice_id).toBeUndefined();
        expect(byPath("tree_spec.nodes.start.choices.1.render_hints")).toMatchObject({
            node_id: "start",
            choice_id: "go",
        });
        expect(byPath("tree_spec.nodes.start.choices.1.feedback")).toMatchObject({
            node_id: "start",
            choice_id: "go",
        });
        expect(byPath("tree_spec.nodes.start.choices.2.id")?.choice_id).toBeUndefined();
        expect(byPath("tree_spec.nodes.start.choices.2.label")?.node_id).toBe("start");
    });
});

describe("null optional fields", () => {
    it("treats null typed optionals as absent and keeps opaque JSON nulls", () => {
        const result = parseTreeSpecWire({
            wire_version: null,
            start_node: "start",
            nodes: {
                start: {
                    type: "prompt",
                    prompt: "Choose",
                    render_hints: null,
                    options: null,
                    choices: [{ id: "go", label: "Go", render_hints: null, feedback: null }],
                },
            },
            transitions: [{ from: ["start", "go"], to: "END", outcome: null }, { from: ["start", "go"], to: "END", outcome: "safe" }],
            _meta: null,
        });

        expect(result.issues.map((issue) => issue.code)).toEqual(["missing_terminal_outcome", "duplicate_transition_source"]);

        const valid = parseTreeSpecWire({
            wire_version: null,
            start_node: "start",
            nodes: { start: { type: "prompt", prompt: "Choose", render_hints: null, options: null, choices: [{ id: "go", label: "Go", feedback: null }] } },
            transitions: [{ from: ["start", "go"], to: "END", outcome: "safe" }],
            _meta: null,
        });
        expect(valid.issues).toEqual([]);
        expect(valid.value).toEqual({
            start_node: "start",
            nodes: { start: { type: "prompt", prompt: "Choose", choices: [{ id: "go", label: "Go", feedback: null }] } },
            transitions: [{ from: ["start", "go"], to: "END", outcome: "safe" }],
        });
    });
});
