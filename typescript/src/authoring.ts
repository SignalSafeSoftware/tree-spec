/** Additive, non-normalizing authoring validation from the Python-owned schema. */
import type { TREESPEC_WIRE_VERSION } from "./constants.js";
import { AUTHORING_SCHEMA } from "./authoringSchema.js";
import type { TerminalOutcome, TreeSpecIssue, TreeSpecIssuePath } from "./types.js";

export type AuthoringJsonValue = null | string | boolean | number | AuthoringJsonValue[] | { [key: string]: AuthoringJsonValue };
export type AuthoringChoice = { id: string; label: string; render_hints?: Record<string, AuthoringJsonValue>; feedback?: AuthoringJsonValue };
export type AuthoringNode = { type: string; prompt: string; choices: AuthoringChoice[]; render_hints?: Record<string, AuthoringJsonValue> };
export type AuthoringTransition = { from: [string, string]; to: string; outcome?: TerminalOutcome; delta?: AuthoringJsonValue; feedback?: AuthoringJsonValue; lessons_triggered?: AuthoringJsonValue };
export type TreeSpecAuthoringDocument = {
    start_node: string;
    nodes: Record<string, AuthoringNode>;
    transitions: AuthoringTransition[];
    wire_version?: typeof TREESPEC_WIRE_VERSION;
    _meta?: Record<string, AuthoringJsonValue>;
    _ab?: AuthoringJsonValue;
};
export type AuthoringValidationResult = { value: TreeSpecAuthoringDocument | null; issues: TreeSpecIssue[] };

type Schema =
    | { readonly $ref: string }
    | { readonly anyOf: readonly Schema[] }
    | { readonly type: "null" }
    | { readonly type: "boolean" }
    | { readonly type: "integer"; readonly minimum?: number; readonly maximum?: number }
    | { readonly type: "number"; readonly minimum?: number; readonly maximum?: number }
    | { readonly type: "string"; readonly minLength?: number; readonly maxLength?: number; readonly enum?: readonly unknown[] }
    | { readonly type: "array"; readonly items: Schema; readonly minItems?: number; readonly maxItems?: number }
    | { readonly type: "object"; readonly properties?: Readonly<Record<string, Schema>>; readonly required?: readonly string[]; readonly additionalProperties: false | Schema };
const definitions: Readonly<Record<string, Schema>> = AUTHORING_SCHEMA.$defs;
const has = (value: object, key: PropertyKey): boolean => Object.hasOwn(value, key);

function object(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

/** Accept only own keys represented by JSON serialization, without dropping data. */
function jsonOwnKeys(value: object): boolean {
    if (Object.getOwnPropertySymbols(value).length) return false;
    const keys = Object.getOwnPropertyNames(value);
    if (Array.isArray(value)) {
        return keys.length === value.length + 1 && keys.every((key) =>
            key === "length" || (/^(?:0|[1-9]\d*)$/.test(key) && Number(key) < value.length));
    }
    return keys.every((key) => Object.prototype.propertyIsEnumerable.call(value, key));
}

function issue(path: TreeSpecIssuePath, constraint = false): TreeSpecIssue {
    return {
        severity: "error",
        code: constraint ? "invalid_field_value" : "invalid_field_type",
        message: constraint ? "Authoring field violates its declared constraints." : "Invalid or missing authoring field.",
        path,
    };
}

function validate(schema: Schema, value: unknown, path: TreeSpecIssuePath, ancestors: Set<object>): TreeSpecIssue[] {
    if ("$ref" in schema) {
        const reference = schema.$ref.slice("#/$defs/".length);
        return validate(definitions[reference], value, path, ancestors);
    }
    if ("anyOf" in schema) {
        return schema.anyOf.some((branch) => validate(branch, value, path, ancestors).length === 0) ? [] : [issue(path)];
    }

    if (schema.type === "null") return value === null ? [] : [issue(path)];
    if (schema.type === "boolean") return typeof value === "boolean" ? [] : [issue(path)];
    if (schema.type === "number" || schema.type === "integer") return validateNumber(schema, value, path);
    if (schema.type === "string") return validateString(schema, value, path);
    if (schema.type === "array") return validateArray(schema, value, path, ancestors);
    return validateObject(schema, value, path, ancestors);
}

function validateNumber(schema: Extract<Schema, { type: "number" | "integer" }>, value: unknown, path: TreeSpecIssuePath): TreeSpecIssue[] {
    if (typeof value !== "number" || !Number.isFinite(value) || (schema.type === "integer" && !Number.isInteger(value))) return [issue(path)];
    return (schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum) ? [issue(path, true)] : [];
}

function validateString(schema: Extract<Schema, { type: "string" }>, value: unknown, path: TreeSpecIssuePath): TreeSpecIssue[] {
    if (typeof value !== "string") return [issue(path)];
    const length = [...value].length;
    return (schema.minLength !== undefined && length < schema.minLength) || (schema.maxLength !== undefined && length > schema.maxLength) || (schema.enum !== undefined && !schema.enum.includes(value)) ? [issue(path, true)] : [];
}

function validateArray(schema: Extract<Schema, { type: "array" }>, value: unknown, path: TreeSpecIssuePath, ancestors: Set<object>): TreeSpecIssue[] {
    if (!Array.isArray(value) || !jsonOwnKeys(value) || ancestors.has(value)) return [issue(path)];
    if ((schema.minItems !== undefined && value.length < schema.minItems) || (schema.maxItems !== undefined && value.length > schema.maxItems)) return [issue(path, true)];
    ancestors.add(value);
    const errors = Array.from(value).flatMap((child, index) => validate(schema.items, child, [...path, index], ancestors));
    ancestors.delete(value);
    return errors;
}

function validateObject(schema: Extract<Schema, { type: "object" }>, value: unknown, path: TreeSpecIssuePath, ancestors: Set<object>): TreeSpecIssue[] {
    if (!object(value) || !jsonOwnKeys(value) || ancestors.has(value)) return [issue(path)];
    ancestors.add(value);
    const errors: TreeSpecIssue[] = [];
    for (const key of schema.required ?? []) if (!has(value, key)) errors.push(issue([...path, key]));
    for (const key of Object.keys(value)) {
        const declared = schema.properties !== undefined && has(schema.properties, key) ? schema.properties[key] : undefined;
        if (declared !== undefined) errors.push(...validate(declared, value[key], [...path, key], ancestors));
        else if (schema.additionalProperties === false) errors.push(issue([...path, key], true));
        else errors.push(...validate(schema.additionalProperties, value[key], [...path, key], ancestors));
    }
    ancestors.delete(value);
    return errors;
}


/** Closed complete core, opaque JSON preserved; graph lint is a separate step.
 * No aliases, trimming, default insertion or legacy-terminal conversion occurs.
 */
export function validateAuthoringDocument(raw: unknown): AuthoringValidationResult {
    try {
        const issues = validate(AUTHORING_SCHEMA, raw, ["tree_spec"], new Set());
        // The generated Pydantic schema proves this exact shape before narrowing.
        return { value: issues.length === 0 ? raw as TreeSpecAuthoringDocument : null, issues };
    } catch {
        return { value: null, issues: [issue(["tree_spec"])] };
    }
}
