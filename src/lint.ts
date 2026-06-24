import {
    END_NODE_ID,
    LEGACY_END_NODE_ID,
    TREESPEC_WIRE_VERSION,
    TREE_SPEC_ISSUE_SEVERITY,
} from "./constants.js";
import type { TreeSpecIssue, TreeSpecWire } from "./types.js";

function lintWireVersion(raw: TreeSpecWire): TreeSpecIssue[] {
    const wv = raw.wire_version;
    if (wv === undefined) {
        return [];
    }
    if (typeof wv !== "number" || !Number.isInteger(wv)) {
        return [
            {
                severity: TREE_SPEC_ISSUE_SEVERITY.ERROR,
                message: "wire_version must be an integer when present.",
            },
        ];
    }
    if (wv !== TREESPEC_WIRE_VERSION) {
        return [
            {
                severity: TREE_SPEC_ISSUE_SEVERITY.ERROR,
                message: `Unsupported wire_version ${wv}; only ${TREESPEC_WIRE_VERSION} is supported.`,
            },
        ];
    }
    return [];
}

/**
 * Local structural checks on a wire payload (complements server-side validation).
 */
export function lintTreeSpecWire(raw: TreeSpecWire): TreeSpecIssue[] {
    const issues: TreeSpecIssue[] = [...lintWireVersion(raw)];
    for (const t of raw.transitions || []) {
        const to = String((t as { to?: string }).to ?? "");
        const fromNodeId = String(
            (t as { from?: [string, string] }).from?.[0] ?? "",
        );
        const fromChoiceId = String(
            (t as { from?: [string, string] }).from?.[1] ?? "",
        );
        if (to === END_NODE_ID || to === LEGACY_END_NODE_ID) {
            const tt = t as { outcome?: string };
            if (!("outcome" in t) || tt.outcome == null) {
                issues.push({
                    severity: TREE_SPEC_ISSUE_SEVERITY.ERROR,
                    message:
                        "Transition to END is missing required outcome (safe / at_risk / compromised).",
                    node_id: fromNodeId || undefined,
                    choice_id: fromChoiceId || undefined,
                });
            }
        }
    }
    return issues;
}
