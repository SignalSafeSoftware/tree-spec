import { describe, expect, it } from "vitest";
import { END_NODE_ID } from "../src/constants";
import { lintTreeSpecGraph } from "../src/lint";
import { parseTreeSpecWire } from "../src/parse";
import type { TreeSpecWire } from "../src/types";

describe("strict validation edge cases", () => {
    it("rejects malformed roots, nodes, choices, transitions, and extensions", () => {
        const cyclicObject: Record<string, object> = {};
        cyclicObject.self = cyclicObject;
        const cyclicArray: unknown[] = [];
        cyclicArray.push(cyclicArray);

        const result = parseTreeSpecWire({
            start_node: 7,
            nodes: {
                notAnObject: "invalid",
                malformed: {
                    type: 7,
                    prompt: "   ",
                    choices: "invalid",
                    options: "invalid",
                },
                malformedChoice: {
                    type: "prompt",
                    prompt: "Prompt",
                    choices: [
                        null,
                        { id: 7, label: "Label" },
                        { id: "ok", label: "   ", render_hints: [], feedback: NaN },
                    ],
                },
            },
            transitions: [
                null,
                { from: ["only"] },
                {
                    from: [7, "choice"],
                    to: 8,
                    outcome: "invalid",
                    delta: Infinity,
                    feedback: () => true,
                    lessons_triggered: Symbol("lesson"),
                },
            ],
            wire_version: "1",
            _meta: cyclicObject,
            _ab: cyclicArray,
        });

        expect(result.value).toBeNull();
        expect(result.issues.map((entry) => entry.code)).toEqual(
            expect.arrayContaining([
                "invalid_field_type",
                "invalid_field_value",
            ]),
        );
        expect(result.issues).toHaveLength(23);
    });

    it("decodes valid JSON extensions, trims text, and normalizes legacy END", () => {
        const result = parseTreeSpecWire({
            wire_version: 1,
            start_node: " start ",
            nodes: {
                start: {
                    type: " prompt ",
                    prompt: " Choose ",
                    render_hints: { theme: { tone: "info" } },
                    choices: [
                        {
                            id: " go ",
                            label: " Go ",
                            render_hints: { editor: { x: 1 } },
                            feedback: ["good", { detail: true }],
                        },
                    ],
                },
            },
            transitions: [
                {
                    from: [" start ", " go "],
                    to: "__END__",
                    outcome: "compromised",
                    delta: [1, { score: -1 }],
                    feedback: null,
                    lessons_triggered: [],
                },
            ],
            _meta: { vendor: { enabled: true } },
            _ab: ["extension"],
        });

        expect(result.issues).toEqual([]);
        expect(result.value).toEqual({
            wire_version: 1,
            start_node: "start",
            nodes: {
                start: {
                    type: "prompt",
                    prompt: "Choose",
                    render_hints: { theme: { tone: "info" } },
                    choices: [
                        {
                            id: "go",
                            label: "Go",
                            render_hints: { editor: { x: 1 } },
                            feedback: ["good", { detail: true }],
                        },
                    ],
                },
            },
            transitions: [
                {
                    from: ["start", "go"],
                    to: END_NODE_ID,
                    outcome: "compromised",
                    delta: [1, { score: -1 }],
                    feedback: null,
                    lessons_triggered: [],
                },
            ],
            _meta: { vendor: { enabled: true } },
            _ab: ["extension"],
        });
    });

    it("normalizes legacy options with opaque choice feedback", () => {
        const result = parseTreeSpecWire({
            start_node: "legacy",
            nodes: {
                legacy: {
                    type: "prompt",
                    prompt: "Legacy",
                    options: [{ id: "finish", label: "Finish", feedback: { tone: "good" } }],
                },
            },
            transitions: [{ from: ["legacy", "finish"], to: END_NODE_ID, outcome: "safe" }],
        });

        expect(result.issues).toEqual([]);
        expect(result.value?.nodes.legacy?.options?.[0]?.feedback).toEqual({ tone: "good" });
    });

    it("rejects an unsupported wire version during strict decoding", () => {
        const result = parseTreeSpecWire({
            wire_version: 2,
            start_node: "start",
            nodes: {
                start: {
                    type: "prompt",
                    prompt: "Start",
                    choices: [{ id: "finish", label: "Finish" }],
                },
            },
            transitions: [],
        });

        expect(result.value).toBeNull();
        expect(result.issues.map((entry) => entry.code)).toContain(
            "unsupported_wire_version",
        );
    });

    it("rejects invalid root containers before graph validation", () => {
        expect(parseTreeSpecWire(null).issues[0]?.code).toBe("invalid_root");

        const invalidNodes = parseTreeSpecWire({
            start_node: "start",
            nodes: [],
            transitions: [],
        });
        expect(invalidNodes.issues.map((entry) => entry.code)).toContain("invalid_field_type");

        const emptyNodes = parseTreeSpecWire({
            start_node: "start",
            nodes: {},
            transitions: "invalid",
        });
        expect(emptyNodes.issues.map((entry) => entry.code)).toContain("invalid_field_value");
        expect(emptyNodes.issues.map((entry) => entry.code)).toContain("invalid_field_type");
    });

    it("reports graph diagnostics for missing sources, choices, outcomes, and paths", () => {
        const issues = lintTreeSpecGraph({
            start_node: "start",
            nodes: {
                start: {
                    type: "prompt",
                    prompt: "Start",
                    choices: [
                        { id: "toEmpty", label: "Empty" },
                        { id: "toDead", label: "Dead" },
                        { id: "orphan", label: "Orphan" },
                    ],
                },
                empty: { type: "prompt", prompt: "Empty" },
                dead: {
                    type: "prompt",
                    prompt: "Dead",
                    choices: [{ id: "loop", label: "Loop" }],
                },
                partial: {
                    type: "prompt",
                    prompt: "Partial",
                    choices: [{ id: "orphan", label: "Orphan" }],
                },
            },
            transitions: [
                { from: ["unknown", "choice"], to: "missing" },
                { from: ["unknown", "choice"], to: END_NODE_ID, outcome: "safe" },
                { from: ["start", "missingChoice"], to: END_NODE_ID },
                { from: ["start", "toEmpty"], to: "empty", outcome: "safe" },
                { from: ["start", "toDead"], to: "dead" },
                { from: ["dead", "loop"], to: "dead" },
            ],
        });

        expect(issues.map((entry) => entry.code)).toEqual(
            expect.arrayContaining([
                "node_without_choices",
                "transition_node_not_found",
                "transition_choice_not_found",
                "missing_terminal_outcome",
                "unexpected_nonterminal_outcome",
                "transition_target_not_found",
                "missing_choice_transition",
                "no_terminal_path",
            ]),
        );
    });

    it("handles absent start IDs and duplicate pending graph nodes", () => {
        const missingStart = lintTreeSpecGraph({
            start_node: undefined as unknown as string,
            nodes: {},
            transitions: [],
        });
        expect(missingStart[0]?.code).toBe("start_node_not_found");

        const graphWithCycle: TreeSpecWire = {
            start_node: "a",
            nodes: {
                a: {
                    type: "prompt",
                    prompt: "A",
                    choices: [
                        { id: "b", label: "B" },
                        { id: "c", label: "C" },
                    ],
                },
                b: {
                    type: "prompt",
                    prompt: "B",
                    choices: [{ id: "back", label: "Back" }],
                },
                c: {
                    type: "prompt",
                    prompt: "C",
                    choices: [{ id: "back", label: "Back" }],
                },
            },
            transitions: [
                { from: ["a", "b"], to: "b" },
                { from: ["a", "c"], to: "b" },
                { from: ["b", "back"], to: "a" },
            ],
        };

        expect(lintTreeSpecGraph(graphWithCycle).map((entry) => entry.code)).toEqual(
            expect.arrayContaining(["no_terminal_path"]),
        );
    });

    it("handles an undefined terminal source from an untrusted decoded shape", () => {
        const issues = lintTreeSpecGraph({
            start_node: "start",
            nodes: {
                start: {
                    type: "prompt",
                    prompt: "Start",
                    choices: [{ id: "finish", label: "Finish" }],
                },
            },
            transitions: [
                {
                    from: [undefined, "finish"],
                    to: END_NODE_ID,
                    outcome: "safe",
                } as unknown as TreeSpecWire["transitions"][number],
                { from: ["start", "finish"], to: END_NODE_ID, outcome: "safe" },
            ],
        });

        expect(issues.map((entry) => entry.code)).toContain("transition_node_not_found");
    });
});
