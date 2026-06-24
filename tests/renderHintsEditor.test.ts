import { describe, expect, it } from "vitest";
import {
    GRAPH_POSITION_KEY,
    RENDER_HINTS_EDITOR_NS,
    readGraphPosition,
    writeGraphPosition,
} from "../src/renderHintsEditor.js";

describe("readGraphPosition", () => {
    it("returns undefined for missing or non-record hints", () => {
        expect(readGraphPosition(undefined)).toBeUndefined();
        expect(readGraphPosition(null as unknown as Record<string, unknown>)).toBeUndefined();
        expect(readGraphPosition("not-a-record" as unknown as Record<string, unknown>)).toBeUndefined();
    });

    it("returns undefined when editor namespace is missing or invalid", () => {
        expect(readGraphPosition({})).toBeUndefined();
        expect(
            readGraphPosition({ [RENDER_HINTS_EDITOR_NS]: "bad" }),
        ).toBeUndefined();
    });

    it("returns undefined for invalid graph_position", () => {
        expect(
            readGraphPosition({
                [RENDER_HINTS_EDITOR_NS]: { [GRAPH_POSITION_KEY]: null },
            }),
        ).toBeUndefined();
        expect(
            readGraphPosition({
                [RENDER_HINTS_EDITOR_NS]: { [GRAPH_POSITION_KEY]: { x: 1 } },
            }),
        ).toBeUndefined();
    });

    it("returns undefined for non-finite coordinates", () => {
        expect(
            readGraphPosition({
                [RENDER_HINTS_EDITOR_NS]: {
                    [GRAPH_POSITION_KEY]: { x: NaN, y: 1 },
                },
            }),
        ).toBeUndefined();
        expect(
            readGraphPosition({
                [RENDER_HINTS_EDITOR_NS]: {
                    [GRAPH_POSITION_KEY]: { x: 1, y: Infinity },
                },
            }),
        ).toBeUndefined();
    });

    it("reads valid graph_position", () => {
        expect(
            readGraphPosition({
                [RENDER_HINTS_EDITOR_NS]: {
                    [GRAPH_POSITION_KEY]: { x: 10, y: 20 },
                },
            }),
        ).toEqual({ x: 10, y: 20 });
    });
});

describe("writeGraphPosition", () => {
    it("writes position into a new hints object", () => {
        expect(writeGraphPosition(undefined, { x: 5, y: 15 })).toEqual({
            [RENDER_HINTS_EDITOR_NS]: {
                [GRAPH_POSITION_KEY]: { x: 5, y: 15 },
            },
        });
    });

    it("merges into existing editor keys without clobbering", () => {
        const hints = {
            other_key: "keep",
            [RENDER_HINTS_EDITOR_NS]: {
                edgeType: "smoothstep",
                [GRAPH_POSITION_KEY]: { x: 1, y: 2 },
            },
        };

        const next = writeGraphPosition(hints, { x: 99, y: 88 });

        expect(next.other_key).toBe("keep");
        expect(next[RENDER_HINTS_EDITOR_NS]).toEqual({
            edgeType: "smoothstep",
            [GRAPH_POSITION_KEY]: { x: 99, y: 88 },
        });
    });

    it("clears graph_position when position is undefined", () => {
        const hints = {
            [RENDER_HINTS_EDITOR_NS]: {
                edgeType: "step",
                [GRAPH_POSITION_KEY]: { x: 1, y: 2 },
            },
        };

        const next = writeGraphPosition(hints, undefined);

        expect(next[RENDER_HINTS_EDITOR_NS]).toEqual({ edgeType: "step" });
        expect(
            (next[RENDER_HINTS_EDITOR_NS] as Record<string, unknown>)[
                GRAPH_POSITION_KEY
            ],
        ).toBeUndefined();
    });

    it("removes editor namespace when only graph_position existed", () => {
        const hints = {
            top_level: true,
            [RENDER_HINTS_EDITOR_NS]: {
                [GRAPH_POSITION_KEY]: { x: 1, y: 2 },
            },
        };

        const next = writeGraphPosition(hints, undefined);

        expect(next.top_level).toBe(true);
        expect(next[RENDER_HINTS_EDITOR_NS]).toBeUndefined();
    });

    it("preserves other top-level hint keys when clearing position", () => {
        const hints = {
            label_color: "blue",
            [RENDER_HINTS_EDITOR_NS]: {
                [GRAPH_POSITION_KEY]: { x: 0, y: 0 },
            },
        };

        const next = writeGraphPosition(hints, undefined);

        expect(next.label_color).toBe("blue");
        expect(next[RENDER_HINTS_EDITOR_NS]).toBeUndefined();
    });

    it("drops invalid position instead of writing it", () => {
        const hints = {
            [RENDER_HINTS_EDITOR_NS]: {
                [GRAPH_POSITION_KEY]: { x: 1, y: 2 },
            },
        };

        const next = writeGraphPosition(hints, {
            x: NaN,
            y: 1,
        });

        expect(next[RENDER_HINTS_EDITOR_NS]).toBeUndefined();
    });
});
