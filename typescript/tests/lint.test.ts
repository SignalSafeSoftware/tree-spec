import { describe, expect, it } from "vitest";
import { END_NODE_ID, LEGACY_END_NODE_ID } from "../src/constants";
import { isTreeSpecWire } from "../src/guards";
import { lintTreeSpecWire } from "../src/lint";
import type { TreeSpecWire } from "../src/types";

describe("lintTreeSpecWire", () => {
    it("flags END transition without outcome", () => {
        const raw: TreeSpecWire = {
            start_node: "a",
            nodes: {},
            transitions: [{ from: ["a", "c1"], to: END_NODE_ID }],
        };
        const issues = lintTreeSpecWire(raw);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.severity).toBe("error");
        expect(issues[0]?.node_id).toBe("a");
        expect(issues[0]?.choice_id).toBe("c1");
    });

    it("accepts END transition with outcome", () => {
        const raw: TreeSpecWire = {
            start_node: "a",
            nodes: {},
            transitions: [
                { from: ["a", "c1"], to: END_NODE_ID, outcome: "safe" },
            ],
        };
        expect(lintTreeSpecWire(raw)).toHaveLength(0);
    });

    it("accepts the current wire version and ignores non-END transitions without outcomes", () => {
        expect(
            lintTreeSpecWire({
                start_node: "a",
                nodes: {},
                transitions: [{ from: ["a", "c1"], to: "b" }],
                wire_version: 1,
            }),
        ).toEqual([]);
    });

    it("flags invalid and unsupported wire_version values", () => {
        const invalidType = lintTreeSpecWire({
            start_node: "a",
            nodes: {},
            transitions: [],
            wire_version: "1" as unknown as number,
        });
        const unsupported = lintTreeSpecWire({
            start_node: "a",
            nodes: {},
            transitions: [],
            wire_version: 2,
        });

        expect(invalidType[0]?.message).toContain(
            "wire_version must be an integer",
        );
        expect(unsupported[0]?.message).toContain("Unsupported wire_version 2");
    });

    it("treats legacy END as terminal and exposes the shape guard", () => {
        const raw: TreeSpecWire = {
            start_node: "a",
            nodes: {},
            transitions: [{ from: ["a", "c1"], to: LEGACY_END_NODE_ID }],
        };

        const issues = lintTreeSpecWire(raw);
        expect(issues).toHaveLength(1);
        expect(issues[0]?.message).toContain("missing required outcome");
        expect(isTreeSpecWire(raw)).toBe(true);
        expect(isTreeSpecWire(null)).toBe(false);
        expect(isTreeSpecWire({ nodes: {} })).toBe(false);
    });

    it("handles missing transitions and missing from metadata on END issues", () => {
        expect(
            lintTreeSpecWire({
                start_node: "a",
                nodes: {},
            } as unknown as TreeSpecWire),
        ).toEqual([]);

        const issues = lintTreeSpecWire({
            start_node: "a",
            nodes: {},
            transitions: [
                {
                    to: END_NODE_ID,
                } as unknown as TreeSpecWire["transitions"][number],
            ],
        });

        expect(issues).toHaveLength(1);
        expect(issues[0]?.node_id).toBeUndefined();
        expect(issues[0]?.choice_id).toBeUndefined();

        const blankFromIssues = lintTreeSpecWire({
            start_node: "a",
            nodes: {},
            transitions: [
                {
                    from: ["", ""],
                    to: END_NODE_ID,
                },
            ],
        });

        expect(blankFromIssues).toHaveLength(1);
        expect(blankFromIssues[0]?.node_id).toBeUndefined();
        expect(blankFromIssues[0]?.choice_id).toBeUndefined();

        expect(
            lintTreeSpecWire({
                start_node: "a",
                nodes: {},
                transitions: [
                    {} as unknown as TreeSpecWire["transitions"][number],
                ],
            }),
        ).toEqual([]);
    });
});
