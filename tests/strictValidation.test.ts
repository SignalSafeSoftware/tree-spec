import { describe, expect, it } from "vitest";
import { END_NODE_ID } from "../src/constants";
import { lintTreeSpecGraph } from "../src/lint";
import { parseTreeSpecWire } from "../src/parse";

const terminal = { from: ["start", "finish"] as [string, string], to: END_NODE_ID, outcome: "safe" as const };

describe("strict TreeSpec validation", () => {
    it("normalizes legacy options and END while preserving opaque metadata", () => {
        const result = parseTreeSpecWire({
            start_node: "start",
            nodes: { start: { type: "prompt", prompt: "Choose", options: [{ id: "finish", label: "Finish" }] } },
            transitions: [{ from: ["start", "finish"], to: "__END__", outcome: "safe" }],
            _meta: { vendor: { flag: true } },
        });

        expect(result.issues).toEqual([]);
        expect(result.value?.transitions[0]?.to).toBe(END_NODE_ID);
        expect(result.value?._meta).toEqual({ vendor: { flag: true } });
        expect(result.value?.nodes.start?.options?.[0]?.id).toBe("finish");
    });

    it("returns stable locations and codes for malformed graph relationships", () => {
        const result = parseTreeSpecWire({
            start_node: "start",
            nodes: {
                start: {
                    type: "prompt",
                    prompt: "Choose",
                    choices: [{ id: "go", label: "Go" }, { id: "go", label: "Again" }],
                },
                orphan: { type: "prompt", prompt: "Never reached", choices: [{ id: "end", label: "End" }] },
            },
            transitions: [{ from: ["start", "go"], to: "missing" }],
        });

        expect(result.value).toBeNull();
        expect(result.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining([
            "duplicate_choice_id",
            "transition_target_not_found",
            "missing_choice_transition",
            "unreachable_node",
        ]));
        expect(result.issues.every((entry) => entry.path !== undefined)).toBe(true);
    });

    it("requires every reachable node to have a terminal path", () => {
        const result = parseTreeSpecWire({
            start_node: "start",
            nodes: {
                start: { type: "prompt", prompt: "Start", choices: [{ id: "loop", label: "Loop" }] },
            },
            transitions: [{ from: ["start", "loop"], to: "start" }],
        });

        expect(result.issues.map((entry) => entry.code)).toContain("no_terminal_path");
    });

    it("allows cycles when every reachable node can still reach END", () => {
        const result = parseTreeSpecWire({
            start_node: "a",
            nodes: {
                a: {
                    type: "prompt",
                    prompt: "A",
                    choices: [
                        { id: "loop", label: "Loop" },
                        { id: "finish", label: "Finish" },
                    ],
                },
                b: {
                    type: "prompt",
                    prompt: "B",
                    choices: [{ id: "back", label: "Back" }],
                },
            },
            transitions: [
                { from: ["a", "loop"], to: "b" },
                { from: ["b", "back"], to: "a" },
                { from: ["a", "finish"], to: END_NODE_ID, outcome: "safe" },
            ],
        });

        expect(result.issues).toEqual([]);
        expect(result.value).not.toBeNull();
    });

    it("keeps the compatibility wire linter separate from strict decoding", () => {
        expect(lintTreeSpecGraph({
            start_node: "start",
            nodes: { start: { type: "prompt", prompt: "Done", choices: [{ id: "finish", label: "Finish" }] } },
            transitions: [terminal],
        })).toEqual([]);
    });
});
