import { describe, expect, it } from "vitest";
import {
    GRAPH_EDITOR_META_NS,
    readGraphEditorMeta,
    writeGraphEditorMeta,
} from "../src/graphEditorMeta.js";

describe("graphEditorMeta", () => {
    it("reads empty meta by default", () => {
        expect(readGraphEditorMeta(undefined)).toEqual({});
    });

    it("round-trips end_position and viewport under _meta.graph_editor", () => {
        const meta = writeGraphEditorMeta(undefined, {
            end_position: { x: 880, y: 120 },
            viewport: { x: -40, y: 20, zoom: 0.85 },
        });

        expect(meta[GRAPH_EDITOR_META_NS]).toEqual({
            end_position: { x: 880, y: 120 },
            viewport: { x: -40, y: 20, zoom: 0.85 },
        });
        expect(readGraphEditorMeta(meta)).toEqual({
            end_position: { x: 880, y: 120 },
            viewport: { x: -40, y: 20, zoom: 0.85 },
        });
    });

    it("ignores invalid viewport values", () => {
        const meta = {
            [GRAPH_EDITOR_META_NS]: {
                viewport: { x: 1, y: 2, zoom: 0 },
            },
        };
        expect(readGraphEditorMeta(meta)).toEqual({});
    });

    it("round-trips default_edge_type under _meta.graph_editor", () => {
        const meta = writeGraphEditorMeta(undefined, {
            default_edge_type: "smoothstep",
        });

        expect(meta[GRAPH_EDITOR_META_NS]).toEqual({
            default_edge_type: "smoothstep",
        });
        expect(readGraphEditorMeta(meta)).toEqual({
            default_edge_type: "smoothstep",
        });
    });

    it("clears graph_editor bucket when all fields are removed", () => {
        const seeded = writeGraphEditorMeta(undefined, {
            end_position: { x: 1, y: 2 },
            viewport: { x: 0, y: 0, zoom: 1 },
            default_edge_type: "step",
        });

        const cleared = writeGraphEditorMeta(seeded, {
            end_position: undefined,
            viewport: undefined,
            default_edge_type: undefined,
        });

        expect(cleared[GRAPH_EDITOR_META_NS]).toBeUndefined();
        expect(readGraphEditorMeta(cleared)).toEqual({});
    });

    it("ignores invalid end_position, non-record bucket, and invalid default_edge_type", () => {
        expect(readGraphEditorMeta({ [GRAPH_EDITOR_META_NS]: "bad" })).toEqual(
            {},
        );
        expect(
            readGraphEditorMeta({
                [GRAPH_EDITOR_META_NS]: {
                    end_position: { x: "1", y: 2 },
                    default_edge_type: "bezier",
                },
            }),
        ).toEqual({});
        expect(readGraphEditorMeta("bad" as unknown as Record<string, unknown>)).toEqual(
            {},
        );
    });
});
