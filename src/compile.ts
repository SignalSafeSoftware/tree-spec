import { END_NODE_ID, LEGACY_END_NODE_ID, TERMINAL_OUTCOME } from "./constants.js";
import { isRecord } from "./guards.js";
import { readGraphPosition, writeGraphPosition } from "./renderHintsEditor.js";
import { safeUUID } from "./randomId.js";
import type { TreeGraph, TreeSpecTransitionWire, TreeSpecWire } from "./types.js";

type TransitionOptionalFields = {
    feedback?: unknown;
    delta?: unknown;
    lessons_triggered?: unknown;
};

function readChoiceFeedback(choice: { feedback?: unknown }): unknown {
    return "feedback" in choice ? choice.feedback : undefined;
}

function pickTransitionOptionalFields(
    t: TransitionOptionalFields,
): Pick<TransitionOptionalFields, "feedback" | "delta" | "lessons_triggered"> {
    return {
        ...(t.feedback === undefined ? {} : { feedback: t.feedback }),
        ...(t.delta === undefined ? {} : { delta: t.delta }),
        ...(t.lessons_triggered === undefined
            ? {}
            : { lessons_triggered: t.lessons_triggered }),
    };
}

/** Deserialize wire JSON into an authoring graph (assigns fresh transition ids). */
export function decompileTreeSpec(raw: TreeSpecWire): TreeGraph {
    const nodes: TreeGraph["nodes"] = {};
    for (const [id, n] of Object.entries(raw.nodes || {})) {
        const rawChoices = (n.choices?.length ? n.choices : n.options) || [];
        const choices = rawChoices.map((c) => {
            const renderHints = "render_hints" in c ? c.render_hints : undefined;
            const feedback = readChoiceFeedback(c);
            return {
                id: String(c.id),
                label: String(c.label),
                ...(isRecord(renderHints) ? { render_hints: renderHints } : {}),
                ...(feedback === undefined ? {} : { feedback }),
            };
        });
        const render_hints = isRecord(n.render_hints) ? n.render_hints : {};
        const position = readGraphPosition(render_hints);
        nodes[id] = {
            id,
            type: String(n.type ?? "prompt"),
            prompt: String(n.prompt ?? ""),
            render_hints,
            choices,
            ...(position ? { position } : {}),
        };
    }
    const transitions: TreeGraph["transitions"] = (raw.transitions || []).map(
        (t) => {
            const tt = t as TreeSpecTransitionWire;
            const rawTo = String(tt.to ?? "");
            const toNodeId =
                rawTo === END_NODE_ID || rawTo === LEGACY_END_NODE_ID
                    ? END_NODE_ID
                    : rawTo;
            return {
                id: safeUUID(),
                fromNodeId: String(tt.from?.[0] ?? ""),
                fromChoiceId: String(tt.from?.[1] ?? ""),
                toNodeId,
                outcome: tt.outcome,
                ...pickTransitionOptionalFields(tt),
            };
        },
    );
    return {
        start_node: raw.start_node,
        nodes,
        transitions,
        _ab: raw._ab,
        _meta: raw._meta,
    };
}

/** Serialize an authoring graph to wire JSON. */
export function compileTreeSpec(tree: TreeGraph): TreeSpecWire {
    const nodes: TreeSpecWire["nodes"] = {};
    for (const [id, n] of Object.entries(tree.nodes)) {
        const baseHints = isRecord(n.render_hints) ? n.render_hints : {};
        const render_hints =
            n.position === undefined
                ? baseHints
                : writeGraphPosition(baseHints, n.position);
        nodes[id] = {
            type: n.type,
            prompt: n.prompt,
            render_hints,
            choices: n.choices,
        };
    }
    const transitions: TreeSpecWire["transitions"] = tree.transitions
        .filter((t) => t.fromNodeId && t.fromChoiceId && t.toNodeId)
        .map((t) => {
            const isEnd =
                t.toNodeId === END_NODE_ID || t.toNodeId === LEGACY_END_NODE_ID;
            return {
                from: [t.fromNodeId, t.fromChoiceId],
                to: isEnd ? END_NODE_ID : t.toNodeId,
                ...(isEnd ? { outcome: t.outcome ?? TERMINAL_OUTCOME.AT_RISK } : {}),
                ...pickTransitionOptionalFields(t),
            };
        });
    return {
        start_node: tree.start_node,
        nodes,
        transitions,
        _ab: tree._ab,
        _meta: tree._meta,
    };
}
