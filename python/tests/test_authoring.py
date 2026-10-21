"""Mirrored additive authoring contract; legacy runtime parsing stays unchanged."""

import json
import subprocess
import sys
from pathlib import Path
from copy import deepcopy
import pytest
from pydantic import TypeAdapter, ValidationError
from tree_spec import TreeSpec, TreeSpecAuthoringDocument, authoring_json_schema, validate_authoring_document

ROOT = Path(__file__).resolve().parents[1]
CASES = json.loads((Path(__file__).parent / "fixtures/authoring-cases.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=lambda case: case["name"])
def test_authoring_fixture_parity(case):
    before = deepcopy(case["value"])
    if case["valid"]:
        assert validate_authoring_document(case["value"]) == before
        assert TypeAdapter(TreeSpecAuthoringDocument).validate_json(json.dumps(before), strict=True) == before
    else:
        with pytest.raises(ValidationError):
            validate_authoring_document(case["value"])
        adapter = TypeAdapter(TreeSpecAuthoringDocument)
        encoded = json.dumps(before)
        with pytest.raises(ValidationError):
            adapter.validate_json(encoded, strict=True)
    assert case["value"] == before


def test_authority_schema_and_generated_typescript_do_not_drift():
    schema = authoring_json_schema()
    assert schema["additionalProperties"] is False
    assert schema["required"] == ["start_node", "nodes", "transitions"]
    subprocess.run(
        [sys.executable, "scripts/export_authoring_schema.py", "../typescript/src/authoringSchema.ts", "--check"],
        check=True,
        cwd=ROOT,
    )


@pytest.mark.parametrize(
    "value", [float("nan"), float("inf"), float("-inf"), {"nested": float("nan")}, object(), (1, 2), {1: "key"}]
)
def test_non_json_extensions_are_rejected(value):
    document = deepcopy(CASES[0]["value"])
    document["_ab"] = value
    with pytest.raises(ValidationError):
        validate_authoring_document(document)


def test_cyclic_extensions_are_rejected():
    cycle = []
    cycle.append(cycle)
    document = deepcopy(CASES[0]["value"])
    document["_ab"] = cycle
    with pytest.raises(ValidationError):
        validate_authoring_document(document)


def test_python_integral_float_wire_version_is_not_coerced():
    document = deepcopy(CASES[0]["value"])
    document["wire_version"] = 1.0
    with pytest.raises(ValidationError):
        validate_authoring_document(document)


def test_legacy_parser_still_ignores_extra_keys_and_inserts_defaults():
    raw = {"start_node": "s", "nodes": {"s": {"options": [{"id": "c", "label": "C"}], "extra": 1}}, "extra": 1}
    parsed = TreeSpec.parse_tree_spec(raw)
    assert parsed.nodes["s"].type == "prompt"
    assert parsed.nodes["s"].choices[0].id == "c"
    assert "extra" not in parsed.model_dump()


def test_strict_authority_composes_into_host_pydantic_models():
    from pydantic import BaseModel

    class HostBody(BaseModel):
        definition: TreeSpecAuthoringDocument

    raw = deepcopy(CASES[0]["value"])
    assert HostBody.model_validate({"definition": raw}).definition == raw
    raw["wire_version"] = True
    with pytest.raises(ValidationError):
        HostBody.model_validate({"definition": raw})
    assert HostBody.model_json_schema()["$defs"]["TreeSpecAuthoringDocument"]["additionalProperties"] is False


def test_opaque_numbers_preserve_python_scalar_types_without_coercion():
    from tree_spec import MAX_AUTHORING_JSON_NUMBER

    for value in [
        True,
        False,
        0,
        17.0,
        -0.5,
        MAX_AUTHORING_JSON_NUMBER,
        -MAX_AUTHORING_JSON_NUMBER,
        "9223372036854775807",
    ]:
        raw = deepcopy(CASES[0]["value"])
        raw["_ab"] = value
        validated = validate_authoring_document(raw)["_ab"]
        assert validated == value
        assert type(validated) is type(value)


@pytest.mark.parametrize(
    "schema",
    [
        {"type": "string", "pattern": "x"},
        {"type": "object", "additionalProperties": True},
        {"type": "array"},
        {"type": "unrecognized"},
        {"type": "integer", "enum": [1, 2]},
        {"$ref": "#/$defs/AuthoringNode", "minLength": 1},
        {"anyOf": [], "minimum": 1},
    ],
)
def test_generator_rejects_unimplemented_schema_features(schema):
    import runpy

    generator = runpy.run_path(str(ROOT / "scripts/export_authoring_schema.py"))
    with pytest.raises(ValueError):
        generator["check_supported"](schema)


def test_python_numeric_protocols_do_not_coerce_opaque_extensions():
    from decimal import Decimal
    from fractions import Fraction
    from enum import IntEnum

    class Number(IntEnum):
        ONE = 1

    for value in [Decimal("1.5"), Fraction(3, 2), Number.ONE]:
        raw = deepcopy(CASES[0]["value"])
        raw["_ab"] = value
        with pytest.raises(ValidationError):
            validate_authoring_document(raw)
