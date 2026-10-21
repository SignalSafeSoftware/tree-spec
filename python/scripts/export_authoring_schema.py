"""Export or check the additive authoring schema used by the TypeScript validator."""

import argparse
import json
from pathlib import Path
from tree_spec.authoring import authoring_json_schema, MAX_AUTHORING_JSON_NUMBER

ALLOWED = {
    "$defs",
    "$ref",
    "type",
    "title",
    "properties",
    "additionalProperties",
    "items",
    "required",
    "anyOf",
    "enum",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "minimum",
    "maximum",
}


def check_supported(schema: dict[str, object]) -> None:
    unknown = schema.keys() - ALLOWED
    if unknown:
        raise ValueError(f"Unsupported authoring schema features: {sorted(unknown)}")
    if (
        schema.get("type") == "object"
        and schema.get("additionalProperties") is not False
        and not isinstance(schema.get("additionalProperties"), dict)
    ):
        raise ValueError("Authoring objects require an explicit closed or typed extension policy")
    if schema.get("type") == "array" and not isinstance(schema.get("items"), dict):
        raise ValueError("Authoring arrays require typed items")
    kind = schema.get("type")
    if kind is not None and kind not in {"null", "boolean", "integer", "number", "string", "array", "object"}:
        raise ValueError("Unsupported authoring schema type")
    if "enum" in schema and kind != "string":
        raise ValueError("Only string enumerations are supported")
    if "$ref" in schema and schema.keys() - {"$ref", "title"}:
        raise ValueError("Reference refinements must be implemented before generation")
    if "anyOf" in schema and schema.keys() - {"anyOf", "title"}:
        raise ValueError("Union refinements must be implemented before generation")
    check_supported_children(schema)


def check_supported_children(schema: dict[str, object]) -> None:
    """Validate nested schemas in the original definition/property/item/union order."""
    for key in ("$defs", "properties"):
        value = schema.get(key, {})
        if isinstance(value, dict):
            for child in value.values():
                check_supported(child)
    for key in ("items", "additionalProperties"):
        child = schema.get(key)
        if isinstance(child, dict):
            check_supported(child)
    for child in schema.get("anyOf", []):
        check_supported(child)


def render() -> str:
    schema = authoring_json_schema()
    check_supported(schema)
    return (
        "// Generated from tree_spec.authoring; do not edit.\nexport const AUTHORING_SCHEMA = "
        + json.dumps(schema, ensure_ascii=False, sort_keys=True, indent=4)
        + f" as const;\nexport const MAX_AUTHORING_JSON_NUMBER = {MAX_AUTHORING_JSON_NUMBER};\n"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    expected = render()
    if arguments.check:
        if arguments.path.read_text() != expected:
            raise SystemExit("Authoring schema drift: regenerate from current Python authority")
    else:
        arguments.path.write_text(expected)
