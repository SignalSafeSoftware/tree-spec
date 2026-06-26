/**
 * Cross-language contract: same JSON fixtures as `contracts/tree-spec/fixtures`
 * and `backend/shared/tests/test_tree_spec_contract_fixtures.py`.
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

describe("TreeSpec contract fixtures (shared with Python)", () => {
    it("accepts minimal-valid.json", () => {
        const raw = loadFixture("minimal-valid.json");
        expect(lintTreeSpecWire(raw)).toHaveLength(0);
    });

    it("round-trips minimal-valid.json through compile/decompile", () => {
        const raw = loadFixture("minimal-valid.json");
        const graph = decompileTreeSpec(raw);
        const back = compileTreeSpec(graph);
        expect(back.start_node).toBe(raw.start_node);
        expect(Object.keys(back.nodes)).toEqual(Object.keys(raw.nodes));
    });

    it("accepts moderate-valid.json", () => {
        const raw = loadFixture("moderate-valid.json");
        expect(lintTreeSpecWire(raw)).toHaveLength(0);
    });

    it("round-trips moderate-valid.json preserving END outcome", () => {
        const raw = loadFixture("moderate-valid.json");
        const graph = decompileTreeSpec(raw);
        const back = compileTreeSpec(graph);
        const endTransition = back.transitions.find((t) => t.to === END_NODE_ID);
        expect(endTransition?.outcome).toBe("safe");
    });

    it("rejects invalid-end-without-outcome.json (END requires outcome)", () => {
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

    it("treats missing wire_version as implicit v1 (no version issues)", () => {
        const raw: TreeSpecWire = {
            start_node: "s",
            nodes: {
                s: { type: "prompt", prompt: "Hi", choices: [] },
            },
            transitions: [],
        };
        const issues = lintTreeSpecWire(raw);
        expect(issues.some((i) => i.message.includes("wire_version"))).toBe(
            false,
        );
    });

    it("documents TREESPEC_WIRE_VERSION for drift checks", () => {
        expect(TREESPEC_WIRE_VERSION).toBe(1);
    });
});
