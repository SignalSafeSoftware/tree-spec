import { describe, expect, it } from "vitest";
import * as treeSpec from "../src/index";

const EXPECTED_VALUES = [
    "END_NODE_ID",
    "LEGACY_END_NODE_ID",
    "TERMINAL_OUTCOME",
    "TREE_SPEC_ISSUE_SEVERITY",
    "TREESPEC_WIRE_VERSION",
    "GRAPH_EDITOR_META_NS",
] as const;

const EXPECTED_FUNCTIONS = [
    "compileTreeSpec",
    "decompileTreeSpec",
    "lintTreeSpecWire",
    "isRecord",
    "isTreeSpecWire",
    "safeUUID",
    "readGraphEditorMeta",
    "writeGraphEditorMeta",
] as const;

describe("public barrel exports", () => {
    it("exposes documented runtime values and functions", () => {
        for (const name of EXPECTED_VALUES) {
            expect(treeSpec[name]).toBeDefined();
        }
        for (const name of EXPECTED_FUNCTIONS) {
            expect(typeof treeSpec[name]).toBe("function");
        }
    });

    it("documents stable wire and END constants", () => {
        expect(treeSpec.TREESPEC_WIRE_VERSION).toBe(1);
        expect(treeSpec.END_NODE_ID).toBe("END");
        expect(treeSpec.LEGACY_END_NODE_ID).toBe("__END__");
        expect(treeSpec.TERMINAL_OUTCOME).toMatchObject({
            SAFE: "safe",
            AT_RISK: "at_risk",
            COMPROMISED: "compromised",
        });
    });
});
