import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateAuthoringDocument, parseTreeSpecWire } from "../src/index";

type Case = { name: string; value: unknown; valid: boolean };
const cases: Case[] = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/authoring-cases.json", import.meta.url)), "utf8"));
const complete = () => structuredClone(cases[0].value) as Record<string, unknown>;

describe("additive strict authoring contract", () => {
    it.each(cases)("$name", ({ value, valid }) => {
        const before = structuredClone(value);
        const result = validateAuthoringDocument(value);
        expect(result.value !== null).toBe(valid);
        if (valid) expect(result.value).toEqual(before);
        else expect(result.issues.length).toBeGreaterThan(0);
        expect(value).toEqual(before);
    });
    it.each([NaN, Infinity, -Infinity, { nested: NaN }, undefined, () => 0, new Date(), Symbol("x"), [undefined]])("rejects non-JSON opaque values %s", (value) => {
        expect(validateAuthoringDocument({ ...complete(), _ab: value }).value).toBeNull();
    });
    it("rejects cycles in both JSON objects and arrays", () => {
        const object: Record<string, unknown> = {};
        object.self = object;
        const array: unknown[] = [];
        array.push(array);
        for (const value of [object, array]) expect(validateAuthoringDocument({ ...complete(), _ab: value }).value).toBeNull();
    });
    it("rejects sparse structural arrays", () => {
        expect(validateAuthoringDocument({ ...complete(), transitions: new Array(1) }).value).toBeNull();
    });
    it("accepts null-prototype JSON objects without losing prototype-like keys", () => {
        const raw = Object.assign(Object.create(null), complete());
        raw._meta = JSON.parse('{"__proto__":false,"constructor":0,"toString":""}');
        expect(validateAuthoringDocument(raw).value).toEqual(raw);
    });
    it("fails closed if hostile input throws during inspection", () => {
        const raw = complete();
        Object.defineProperty(raw, "start_node", { enumerable: true, get: () => { throw new Error("hostile getter"); } });
        expect(validateAuthoringDocument(raw)).toEqual({ value: null, issues: [expect.objectContaining({ code: "invalid_field_type", path: ["tree_spec"] })] });
    });
    it("legacy normalization remains independently available", () => {
        const raw = { start_node: "s", nodes: { s: { type: "prompt", prompt: "P", choices: [{ id: "c", label: "C" }] } }, transitions: [{ from: ["s", "c"], to: "__END__", outcome: "safe" }] };
        expect(parseTreeSpecWire(raw).value?.transitions[0].to).toBe("END");
        expect(validateAuthoringDocument(raw).value?.transitions[0].to).toBe("__END__");
    });
});

it("exports the opaque-number limit from the generated authority", async () => {
    const { MAX_AUTHORING_JSON_NUMBER } = await import("../src/index");
    expect(MAX_AUTHORING_JSON_NUMBER).toBe(Number.MAX_SAFE_INTEGER);
});

it("documents JavaScript's indistinguishable integer numeric spellings", () => {
    const wireVersion: unknown = JSON.parse("1.0");
    expect(validateAuthoringDocument({ ...complete(), wire_version: wireVersion }).value?.wire_version).toBe(1);
});


// JavaScript descriptors/symbols have no JSON/Python-dict spelling. These cases
// protect the unknown-input type predicate before the host serializes a request.
function descriptorDocument() {
    return { start_node: "s", nodes: { s: { type: "prompt", prompt: "P", choices: [{ id: "c", label: "C" }] } }, transitions: [{ from: ["s", "c"], to: "END", outcome: "safe" }], _ab: { nested: [1] } };
}

describe("JSON own-key representability", () => {
    it.each(["root", "node", "choice", "transition", "opaque", "array", "from"] as const)("rejects own symbol keys in %s", (location) => {
        const raw = descriptorDocument();
        const locations = { root: raw, node: raw.nodes.s, choice: raw.nodes.s.choices[0], transition: raw.transitions[0], opaque: raw._ab, array: raw._ab.nested, from: raw.transitions[0].from };
        Object.defineProperty(locations[location], Symbol("hidden"), { value: 1 });
        expect(validateAuthoringDocument(raw).value).toBeNull();
    });
    it.each(["root", "node", "choice", "opaque"] as const)("rejects non-enumerable object properties in %s", (location) => {
        const raw = descriptorDocument();
        const locations = { root: raw, node: raw.nodes.s, choice: raw.nodes.s.choices[0], opaque: raw._ab };
        Object.defineProperty(locations[location], "unserialized", { value: 1, enumerable: false });
        expect(validateAuthoringDocument(raw).value).toBeNull();
    });
    it.each(["root", "node", "choice"] as const)("cannot satisfy a required %s field without validating/serializing its value", (location) => {
        const raw = descriptorDocument();
        const [target, key] = location === "root" ? [raw, "start_node"] : location === "node" ? [raw.nodes.s, "type"] : [raw.nodes.s.choices[0], "id"];
        Object.defineProperty(target, key, { value: 123, enumerable: false });
        expect(validateAuthoringDocument(raw).value).toBeNull();
    });
    it.each([true, false])("rejects unserialized array extras, enumerable=%s", (enumerable) => {
        const raw = descriptorDocument();
        Object.defineProperty(raw._ab.nested, "extra", { value: 1, enumerable });
        expect(validateAuthoringDocument(raw).value).toBeNull();
    });
    it.each(["extra", "01", "4294967295"])("rejects a sparse array disguised with extra key %s", (key) => {
        const raw = descriptorDocument();
        raw._ab.nested = new Array<number>(1);
        Object.defineProperty(raw._ab.nested, key, { value: 1, enumerable: true });
        expect(validateAuthoringDocument(raw).value).toBeNull();
    });
    it("accepts non-enumerable numeric array elements because JSON serializes them", () => {
        const raw = descriptorDocument();
        Object.defineProperty(raw._ab.nested, "0", { value: 1, enumerable: false });
        expect(validateAuthoringDocument(raw).value).toBe(raw);
        expect(JSON.stringify(validateAuthoringDocument(raw).value)).toBe(JSON.stringify(raw));
    });
    it("returns a failure when descriptor enumeration on a proxy throws", () => {
        const raw = new Proxy(descriptorDocument(), { ownKeys: () => { throw new Error("hostile ownKeys"); } });
        expect(validateAuthoringDocument(raw)).toEqual({ value: null, issues: [expect.objectContaining({ path: ["tree_spec"] })] });
    });
});
