import {
    END_NODE_ID,
    LEGACY_END_NODE_ID,
    TREESPEC_WIRE_VERSION,
    TREE_SPEC_ISSUE_SEVERITY,
} from "./constants.js";
import type { TreeSpecIssue, TreeSpecIssuePath, TreeSpecTransitionWire, TreeSpecWire } from "./types.js";

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

function graphIssue(
    code: NonNullable<TreeSpecIssue["code"]>,
    message: string,
    path: readonly (string | number)[],
    nodeId?: string,
    choiceId?: string,
    severity: "error" | "warning" = "error",
): TreeSpecIssue {
    return {
        severity,
        code,
        message,
        path,
        ...(nodeId === undefined ? {} : { node_id: nodeId }),
        ...(choiceId === undefined ? {} : { choice_id: choiceId }),
    };
}

function activeChoices(
    node: TreeSpecWire["nodes"][string],
): ReadonlyArray<NonNullable<TreeSpecWire["nodes"][string]["choices"]>[number]> {
    return node.choices ?? node.options ?? [];
}

function sourceKey(nodeId: string, choiceId: string): string {
    return JSON.stringify([nodeId, choiceId]);
}

function walkGraph(
    initial: readonly string[],
    adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> {
    const visited = new Set<string>();
    const pending = [...initial];
    while (pending.length > 0) {
        const nodeId = pending.pop();
        if (nodeId === undefined || visited.has(nodeId)) continue;
        visited.add(nodeId);
        for (const target of adjacency.get(nodeId) ?? []) {
            if (!visited.has(target)) pending.push(target);
        }
    }
    return visited;
}

function addEdge(
    adjacency: Map<string, Set<string>>,
    from: string,
    to: string,
): void {
    const targets = adjacency.get(from) ?? new Set<string>();
    targets.add(to);
    adjacency.set(from, targets);
}

/**
 * Validate graph relationships on an already decoded TreeSpec document.
 *
 * This intentionally does not impose product-specific score or presentation
 * rules. Hosts can add those checks after this generic boundary.
 */
export function lintTreeSpecGraph(raw: TreeSpecWire): TreeSpecIssue[] {
    const issues: TreeSpecIssue[] = [];
    const nodes = Object.fromEntries(
        Object.entries(raw.nodes).filter(([nodeId]) => nodeId !== END_NODE_ID && nodeId !== LEGACY_END_NODE_ID),
    );
    const choiceIds = collectChoiceIds(nodes, issues);

    if (!(raw.start_node in nodes)) {
        issues.push(graphIssue(
            "start_node_not_found",
            `Start node ${JSON.stringify(raw.start_node)} is not present in tree_spec.nodes.`,
            ["tree_spec", "start_node"],
            raw.start_node,
        ));
    }

    const { transitionsBySource, adjacency, reverse, terminalSources } = collectGraphEdges(raw, nodes, choiceIds, issues);

    lintMissingTransitions(nodes, transitionsBySource, issues);

    lintReachability(raw.start_node, nodes, adjacency, reverse, terminalSources, issues);
    return issues;
}

type GraphNodes = TreeSpecWire["nodes"];
type TransitionSources = Map<string, { nodeId: string; target: string }>;
interface GraphEdges {
    transitionsBySource: TransitionSources;
    adjacency: Map<string, Set<string>>;
    reverse: Map<string, Set<string>>;
    terminalSources: Set<string>;
}

function collectChoiceIds(nodes: GraphNodes, issues: TreeSpecIssue[]): Map<string, Set<string>> {
    const choiceIds = new Map<string, Set<string>>();
    for (const [nodeId, node] of Object.entries(nodes)) {
        const choices = activeChoices(node);
        if (choices.length === 0) {
            issues.push(graphIssue(
                "node_without_choices",
                `Node ${JSON.stringify(nodeId)} must define at least one choice.`,
                ["tree_spec", "nodes", nodeId],
                nodeId,
            ));
        }
        const ids = new Set<string>();
        for (const [choiceIndex, choice] of choices.entries()) {
            if (ids.has(choice.id)) {
                issues.push(graphIssue(
                    "duplicate_choice_id",
                    `Choice ID ${JSON.stringify(choice.id)} is duplicated on node ${JSON.stringify(nodeId)}.`,
                    ["tree_spec", "nodes", nodeId, "choices", choiceIndex, "id"],
                    nodeId,
                    choice.id,
                ));
            }
            ids.add(choice.id);
        }
        choiceIds.set(nodeId, ids);
    }

    return choiceIds;
}

function collectGraphEdges(raw: TreeSpecWire, nodes: GraphNodes, choiceIds: ReadonlyMap<string, ReadonlySet<string>>, issues: TreeSpecIssue[]): GraphEdges {
    const transitionsBySource = new Map<string, { nodeId: string; target: string }>();
    const adjacency = new Map<string, Set<string>>();
    const reverse = new Map<string, Set<string>>();
    const terminalSources = new Set<string>();
    for (const [index, transition] of raw.transitions.entries()) {
        const [fromNodeId, fromChoiceId] = transition.from;
        const key = sourceKey(fromNodeId, fromChoiceId);
        const path = ["tree_spec", "transitions", index] as const;
        if (transitionsBySource.has(key)) {
            issues.push(graphIssue(
                "duplicate_transition_source",
                `Choice ${JSON.stringify(fromChoiceId)} on node ${JSON.stringify(fromNodeId)} has more than one transition.`,
                [...path, "from"],
                fromNodeId,
                fromChoiceId,
            ));
        } else {
            transitionsBySource.set(key, { nodeId: fromNodeId, target: transition.to });
        }

        lintTransitionSource(transition, path, choiceIds, issues);

        const terminal = transition.to === END_NODE_ID || transition.to === LEGACY_END_NODE_ID;
        if (terminal) terminalSources.add(fromNodeId);
        lintTransitionOutcome(transition, path, terminal, issues);

        if (!terminal && !(transition.to in nodes)) {
            issues.push(graphIssue(
                "transition_target_not_found",
                `Transition target ${JSON.stringify(transition.to)} is not present in tree_spec.nodes.`,
                [...path, "to"],
                fromNodeId,
                fromChoiceId,
            ));
        } else if (!terminal) {
            addEdge(adjacency, fromNodeId, transition.to);
            addEdge(reverse, transition.to, fromNodeId);
        }
    }

    return { transitionsBySource, adjacency, reverse, terminalSources };
}

function lintTransitionSource(transition: TreeSpecTransitionWire, path: TreeSpecIssuePath, choiceIds: ReadonlyMap<string, ReadonlySet<string>>, issues: TreeSpecIssue[]): void {
    const [fromNodeId, fromChoiceId] = transition.from;
        const nodeChoices = choiceIds.get(fromNodeId);
        if (nodeChoices === undefined) {
            issues.push(graphIssue(
                "transition_node_not_found",
                `Transition references unknown source node ${JSON.stringify(fromNodeId)}.`,
                [...path, "from", 0],
                fromNodeId,
                fromChoiceId,
            ));
        } else if (!nodeChoices.has(fromChoiceId)) {
            issues.push(graphIssue(
                "transition_choice_not_found",
                `Transition references unknown choice ${JSON.stringify(fromChoiceId)} on node ${JSON.stringify(fromNodeId)}.`,
                [...path, "from", 1],
                fromNodeId,
                fromChoiceId,
            ));
        }

}

function lintTransitionOutcome(transition: TreeSpecTransitionWire, path: TreeSpecIssuePath, terminal: boolean, issues: TreeSpecIssue[]): void {
    const [fromNodeId, fromChoiceId] = transition.from;
        if (terminal) {
            if (transition.outcome === undefined) {
                issues.push(graphIssue(
                    "missing_terminal_outcome",
                    "Transition to END must include a terminal outcome.",
                    [...path, "outcome"],
                    fromNodeId,
                    fromChoiceId,
                ));
            }
        } else if (transition.outcome !== undefined) {
            issues.push(graphIssue(
                "unexpected_nonterminal_outcome",
                "A transition to another node must not include a terminal outcome.",
                [...path, "outcome"],
                fromNodeId,
                fromChoiceId,
            ));
        }

}

function lintMissingTransitions(nodes: GraphNodes, transitionsBySource: ReadonlyMap<string, { nodeId: string; target: string }>, issues: TreeSpecIssue[]): void {
    for (const [nodeId, node] of Object.entries(nodes)) {
        for (const [choiceIndex, choice] of activeChoices(node).entries()) {
            if (transitionsBySource.has(sourceKey(nodeId, choice.id))) continue;
            issues.push(graphIssue(
                "missing_choice_transition",
                `Choice ${JSON.stringify(choice.id)} on node ${JSON.stringify(nodeId)} is missing a transition.`,
                ["tree_spec", "nodes", nodeId, "choices", choiceIndex],
                nodeId,
                choice.id,
            ));
        }
    }

}

function lintReachability(startNode: string, nodes: GraphNodes, adjacency: ReadonlyMap<string, ReadonlySet<string>>, reverse: ReadonlyMap<string, ReadonlySet<string>>, terminalSources: ReadonlySet<string>, issues: TreeSpecIssue[]): void {
    if (!(startNode in nodes)) return;
    const reachable = walkGraph([startNode], adjacency);
    for (const nodeId of Object.keys(nodes)) {
        if (reachable.has(nodeId)) continue;
        issues.push(graphIssue(
            "unreachable_node",
            `Node ${JSON.stringify(nodeId)} is unreachable from start node ${JSON.stringify(startNode)}.`,
            ["tree_spec", "nodes", nodeId],
            nodeId,
            undefined,
            "warning",
        ));
    }
    const canReachEnd = walkGraph([...terminalSources], reverse);
    for (const nodeId of reachable) {
        if (canReachEnd.has(nodeId)) continue;
        issues.push(graphIssue(
            "no_terminal_path",
            `Node ${JSON.stringify(nodeId)} has no path to END.`,
            ["tree_spec", "nodes", nodeId],
            nodeId,
        ));
    }
}
