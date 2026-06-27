/**
 * Mirrored TreeSpec contract fixtures — keep aligned with
 * `tree-spec-python/tests/fixtures/` and `tests/fixtures/README.md`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { END_NODE_ID, TREESPEC_WIRE_VERSION } from "../src/constants";
import { compileTreeSpec, decompileTreeSpec } from "../src/compile";
import { lintTreeSpecWire } from "../src/lint";
import type { TreeSpecWire } from "../src/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

function loadFixture(name: string): TreeSpecWire {
    const p = path.join(fixturesDir, name);
    const raw = JSON.parse(readFileSync(p, "utf8")) as unknown;
    return raw as TreeSpecWire;
}

const VALID_FIXTURES = [
    "minimal-valid.json",
    "moderate-valid.json",
    "valid-implicit-wire-version.json",
] as const;

describe("TreeSpec parity fixtures (mirrored with tree-spec-python)", () => {
    describe.each(VALID_FIXTURES)("valid fixture %s", (fixtureName) => {
        it("lints clean", () => {
            const raw = loadFixture(fixtureName);
            expect(lintTreeSpecWire(raw)).toHaveLength(0);
        });

        it("round-trips through compile/decompile", () => {
            const raw = loadFixture(fixtureName);
            const graph = decompileTreeSpec(raw);
            const back = compileTreeSpec(graph);
            expect(back.start_node).toBe(raw.start_node);
            expect(Object.keys(back.nodes).sort()).toEqual(
                Object.keys(raw.nodes).sort(),
            );
        });
    });

    it("moderate-valid preserves transition feedback on round-trip", () => {
        const raw = loadFixture("moderate-valid.json");
        const back = compileTreeSpec(decompileTreeSpec(raw));
        expect(back.transitions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    from: ["s", "continue"],
                    to: "middle",
                    feedback: expect.objectContaining({
                        key: "continue-fb",
                        title: "Good start",
                    }),
                }),
                expect.objectContaining({
                    from: ["middle", "finish"],
                    to: END_NODE_ID,
                    outcome: "safe",
                    feedback: expect.objectContaining({
                        key: "finish-fb",
                        title: "Done",
                    }),
                }),
            ]),
        );
    });

    it("moderate-valid preserves multi-step END outcome on round-trip", () => {
        const raw = loadFixture("moderate-valid.json");
        const back = compileTreeSpec(decompileTreeSpec(raw));
        const endTransition = back.transitions.find((t) => t.to === END_NODE_ID);
        expect(endTransition?.outcome).toBe("safe");
    });

    it("moderate-valid fixture includes transition feedback in wire JSON", () => {
        const raw = loadFixture("moderate-valid.json") as TreeSpecWire & {
            transitions: Array<{ to: string; feedback?: { key?: string } }>;
        };
        const endWire = raw.transitions.find((t) => t.to === END_NODE_ID);
        expect(endWire?.feedback).toMatchObject({
            key: "finish-fb",
            title: "Done",
        });
    });

    it("accepts explicit wire_version 1 on minimal-valid", () => {
        const raw = loadFixture("minimal-valid.json");
        expect(raw.wire_version).toBe(TREESPEC_WIRE_VERSION);
        expect(lintTreeSpecWire(raw)).toHaveLength(0);
    });

    it("rejects invalid-end-without-outcome.json", () => {
        const raw = loadFixture("invalid-end-without-outcome.json");
        const issues = lintTreeSpecWire(raw);
        expect(issues.some((i) => i.message.includes("outcome"))).toBe(true);
    });

    it("rejects invalid-unsupported-wire-version.json", () => {
        const raw = loadFixture("invalid-unsupported-wire-version.json");
        const issues = lintTreeSpecWire(raw);
        expect(
            issues.some((i) => i.message.includes("Unsupported wire_version")),
        ).toBe(true);
    });

    it("rejects invalid-wire-version-boolean.json", () => {
        const raw = loadFixture("invalid-wire-version-boolean.json");
        const issues = lintTreeSpecWire(raw);
        expect(
            issues.some((i) =>
                i.message.includes("wire_version must be an integer"),
            ),
        ).toBe(true);
    });
});

describe("TreeSpec parity gaps (Python lint_tree_spec; TS lintTreeSpecWire)", () => {
    it("does not lint missing_target_node yet (Python code: missing_target_node)", () => {
        const raw = loadFixture("invalid-missing-target.json");
        expect(lintTreeSpecWire(raw)).toHaveLength(0);
    });

    it("does not lint missing_transition yet (Python code: missing_transition)", () => {
        const raw = loadFixture("invalid-missing-transition.json");
        expect(lintTreeSpecWire(raw)).toHaveLength(0);
    });

    it("does not lint unreachable_node yet (Python code: unreachable_node)", () => {
        const raw = loadFixture("invalid-unreachable-node.json");
        expect(lintTreeSpecWire(raw)).toHaveLength(0);
    });

    it("does not lint duplicate_transition yet (Python code: duplicate_transition)", () => {
        const raw = loadFixture("invalid-duplicate-transition.json");
        expect(lintTreeSpecWire(raw)).toHaveLength(0);
    });

    it("does not reject non-END outcome yet (Python parse error)", () => {
        const raw = loadFixture("invalid-non-end-outcome.json");
        expect(lintTreeSpecWire(raw)).toHaveLength(0);
    });
});
