import { END_NODE_ID, LEGACY_END_NODE_ID, TREESPEC_WIRE_VERSION } from "./constants.js";
import { isRecord } from "./guards.js";
import { lintTreeSpecGraph } from "./lint.js";
import type {
    TreeSpecIssue,
    TreeSpecIssueCode,
    TreeSpecIssuePath,
    TreeSpecNodeWire,
    TreeSpecTransitionWire,
    TreeSpecValidationResult,
    TreeSpecWire,
} from "./types.js";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type ParsedChoice = NonNullable<TreeSpecNodeWire["choices"]>[number];

function issue(
    code: TreeSpecIssueCode,
    message: string,
    path: TreeSpecIssuePath,
    nodeId?: string,
    choiceId?: string,
): TreeSpecIssue {
    return {
        severity: "error",
        code,
        message,
        path,
        ...(nodeId === undefined ? {} : { node_id: nodeId }),
        ...(choiceId === undefined ? {} : { choice_id: choiceId }),
    };
}

function isJsonValue(value: unknown, seen = new WeakSet<object>()): value is JsonValue {
    if (value === null || typeof value === "boolean" || typeof value === "string") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) {
        if (seen.has(value)) return false;
        seen.add(value);
        const valid = value.every((entry) => isJsonValue(entry, seen));
        seen.delete(value);
        return valid;
    }
    if (!isRecord(value) || seen.has(value)) return false;
    seen.add(value);
    const valid = Object.values(value).every((entry) => isJsonValue(entry, seen));
    seen.delete(value);
    return valid;
}

function requiredText(
    value: unknown,
    path: TreeSpecIssuePath,
    issues: TreeSpecIssue[],
): string | null {
    if (typeof value !== "string") {
        issues.push(issue("invalid_field_type", "This field must be a string.", path));
        return null;
    }
    const text = value.trim();
    if (text.length === 0) {
        issues.push(issue("invalid_field_value", "This field must not be blank.", path));
        return null;
    }
    return text;
}

function optionalJson(
    value: unknown,
    path: TreeSpecIssuePath,
    issues: TreeSpecIssue[],
): JsonValue | undefined {
    if (value === undefined) return undefined;
    if (!isJsonValue(value)) {
        issues.push(issue("invalid_field_type", "This field must contain JSON-compatible data.", path));
        return undefined;
    }
    return value;
}

function optionalObject(
    value: unknown,
    path: TreeSpecIssuePath,
    issues: TreeSpecIssue[],
): { [key: string]: JsonValue } | undefined {
    const parsed = optionalJson(value, path, issues);
    if (parsed === undefined) return undefined;
    if (!isRecord(parsed) || Array.isArray(parsed)) {
        issues.push(issue("invalid_field_type", "This field must be a JSON object.", path));
        return undefined;
    }
    return parsed;
}

function parseChoice(value: unknown, path: TreeSpecIssuePath, issues: TreeSpecIssue[]): ParsedChoice | null {
    if (!isRecord(value)) {
        issues.push(issue("invalid_field_type", "Each choice must be an object.", path));
        return null;
    }
    const id = requiredText(value.id, [...path, "id"], issues);
    const label = requiredText(value.label, [...path, "label"], issues);
    const renderHints = optionalObject(value.render_hints, [...path, "render_hints"], issues);
    const feedback = optionalJson(value.feedback, [...path, "feedback"], issues);
    if (id === null || label === null) return null;
    const choice = {
        id,
        label,
        ...(renderHints === undefined ? {} : { render_hints: renderHints }),
        ...(feedback === undefined ? {} : { feedback }),
    };
    return choice;
}

function parseNode(value: unknown, nodeId: string, path: TreeSpecIssuePath, issues: TreeSpecIssue[]): TreeSpecNodeWire | null {
    if (!isRecord(value)) {
        issues.push(issue("invalid_field_type", "Each node must be an object.", path, nodeId));
        return null;
    }
    const type = requiredText(value.type, [...path, "type"], issues);
    const prompt = requiredText(value.prompt, [...path, "prompt"], issues);
    const renderHints = optionalObject(value.render_hints, [...path, "render_hints"], issues);
    const choiceValues: TreeSpecNodeWire["choices"] = [];
    const optionValues: TreeSpecNodeWire["options"] = [];
    const choicesValue = value.choices;
    const optionsValue = value.options;
    if (choicesValue !== undefined && !Array.isArray(choicesValue)) {
        issues.push(issue("invalid_field_type", "choices must be an array.", [...path, "choices"], nodeId));
    }
    if (optionsValue !== undefined && !Array.isArray(optionsValue)) {
        issues.push(issue("invalid_field_type", "options must be an array.", [...path, "options"], nodeId));
    }
    const collection: readonly unknown[] | undefined = Array.isArray(choicesValue)
        ? choicesValue
        : Array.isArray(optionsValue)
            ? optionsValue
            : undefined;
    if (collection === undefined) {
        issues.push(issue("invalid_field_value", "A node must define choices or legacy options.", [...path, "choices"], nodeId));
    } else {
        for (const [index, rawChoice] of collection.entries()) {
            const parsed = parseChoice(rawChoice, [...path, Array.isArray(choicesValue) ? "choices" : "options", index], issues);
            if (parsed === null) continue;
            if (Array.isArray(choicesValue)) choiceValues.push(parsed);
            else optionValues.push({ id: parsed.id, label: parsed.label, ...(parsed.feedback === undefined ? {} : { feedback: parsed.feedback }) });
        }
    }
    if (type === null || prompt === null) return null;
    return {
        type,
        prompt,
        ...(renderHints === undefined ? {} : { render_hints: renderHints }),
        ...(Array.isArray(choicesValue) ? { choices: choiceValues } : {}),
        ...(Array.isArray(optionsValue) && !Array.isArray(choicesValue) ? { options: optionValues } : {}),
    };
}

function parseTransition(value: unknown, path: TreeSpecIssuePath, issues: TreeSpecIssue[]): TreeSpecTransitionWire | null {
    if (!isRecord(value)) {
        issues.push(issue("invalid_field_type", "Each transition must be an object.", path));
        return null;
    }
    if (!Array.isArray(value.from) || value.from.length !== 2) {
        issues.push(issue("invalid_field_value", "from must contain exactly a node ID and choice ID.", [...path, "from"]));
        return null;
    }
    const fromNodeId = requiredText(value.from[0], [...path, "from", 0], issues);
    const fromChoiceId = requiredText(value.from[1], [...path, "from", 1], issues);
    const to = requiredText(value.to, [...path, "to"], issues);
    const rawOutcome = value.outcome;
    let outcome: TreeSpecTransitionWire["outcome"];
    if (rawOutcome !== undefined && rawOutcome !== "safe" && rawOutcome !== "at_risk" && rawOutcome !== "compromised") {
        issues.push(issue("invalid_field_value", "outcome must be safe, at_risk, or compromised.", [...path, "outcome"]));
    } else if (rawOutcome !== undefined) {
        outcome = rawOutcome;
    }
    const delta = optionalJson(value.delta, [...path, "delta"], issues);
    const feedback = optionalJson(value.feedback, [...path, "feedback"], issues);
    const lessons = optionalJson(value.lessons_triggered, [...path, "lessons_triggered"], issues);
    if (fromNodeId === null || fromChoiceId === null || to === null) return null;
    const normalizedTo = to === LEGACY_END_NODE_ID ? END_NODE_ID : to;
    return {
        from: [fromNodeId, fromChoiceId],
        to: normalizedTo,
        ...(outcome === undefined ? {} : { outcome }),
        ...(delta === undefined ? {} : { delta }),
        ...(feedback === undefined ? {} : { feedback }),
        ...(lessons === undefined ? {} : { lessons_triggered: lessons }),
    };
}

/** Decode untrusted JSON into a normalized, strictly shaped TreeSpec wire document. */
export function parseTreeSpecWire(raw: unknown): TreeSpecValidationResult {
    const issues: TreeSpecIssue[] = [];
    if (!isRecord(raw)) return { value: null, issues: [issue("invalid_root", "TreeSpec must be a JSON object.", ["tree_spec"]) ] };
    const startNode = requiredText(raw.start_node, ["tree_spec", "start_node"], issues);
    const rawNodes = raw.nodes;
    if (!isRecord(rawNodes)) issues.push(issue("invalid_field_type", "nodes must be an object.", ["tree_spec", "nodes"]));
    if (isRecord(rawNodes) && Object.keys(rawNodes).length === 0) issues.push(issue("invalid_field_value", "nodes must contain at least one node.", ["tree_spec", "nodes"]));
    const nodes: Record<string, TreeSpecNodeWire> = {};
    if (isRecord(rawNodes)) {
        for (const [nodeId, rawNode] of Object.entries(rawNodes)) {
            const parsed = parseNode(rawNode, nodeId, ["tree_spec", "nodes", nodeId], issues);
            if (parsed !== null) nodes[nodeId] = parsed;
        }
    }
    if (!Array.isArray(raw.transitions)) issues.push(issue("invalid_field_type", "transitions must be an array.", ["tree_spec", "transitions"]));
    const transitions: TreeSpecTransitionWire[] = [];
    if (Array.isArray(raw.transitions)) {
        for (const [index, rawTransition] of raw.transitions.entries()) {
            const parsed = parseTransition(rawTransition, ["tree_spec", "transitions", index], issues);
            if (parsed !== null) transitions.push(parsed);
        }
    }
    const rawWireVersion = raw.wire_version;
    let wireVersion: number | undefined;
    if (rawWireVersion !== undefined && (typeof rawWireVersion !== "number" || !Number.isInteger(rawWireVersion))) {
        issues.push(issue("invalid_field_type", "wire_version must be an integer when present.", ["tree_spec", "wire_version"]));
    } else if (rawWireVersion !== undefined) {
        wireVersion = rawWireVersion;
        if (wireVersion !== TREESPEC_WIRE_VERSION) {
            issues.push(issue("unsupported_wire_version", `Unsupported wire_version ${wireVersion}; only ${TREESPEC_WIRE_VERSION} is supported.`, ["tree_spec", "wire_version"]));
        }
    }
    const meta = optionalObject(raw._meta, ["tree_spec", "_meta"], issues);
    const ab = optionalJson(raw._ab, ["tree_spec", "_ab"], issues);
    if (startNode === null || issues.length > 0) return { value: null, issues };
    const wire: TreeSpecWire = {
        start_node: startNode,
        nodes,
        transitions,
        ...(wireVersion === undefined ? {} : { wire_version: wireVersion }),
        ...(meta === undefined ? {} : { _meta: meta }),
        ...(ab === undefined ? {} : { _ab: ab }),
    };
    const graphIssues = lintTreeSpecGraph(wire);
    return { value: graphIssues.some((entry) => entry.severity === "error") ? null : wire, issues: graphIssues };
}
