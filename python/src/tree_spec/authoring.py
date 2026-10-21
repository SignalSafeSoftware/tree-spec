"""Opt-in complete authoring shape; legacy parsing remains a separate API.

Stable objects are closed. Opaque extension values remain product-neutral JSON.
Validation returns the wire document without coercion, defaults or legacy fixes.
Graph semantics are deliberately left to the existing lint APIs.
"""

from typing import Annotated, Literal, NotRequired, TypedDict
from pydantic import BeforeValidator, ConfigDict, Field, TypeAdapter, with_config
from tree_spec.constants import TREESPEC_WIRE_VERSION

MAX_AUTHORING_JSON_NUMBER = 2**53 - 1


def _json_kind(value: object) -> object:
    if value is not None and type(value) not in (str, bool, int, float, list, dict):
        raise ValueError("Opaque authoring values must contain only JSON types")
    return value


type AuthoringJsonValue = Annotated[
    str
    | bool
    | Annotated[int, Field(ge=-MAX_AUTHORING_JSON_NUMBER, le=MAX_AUTHORING_JSON_NUMBER)]
    | Annotated[float, Field(allow_inf_nan=False, ge=-MAX_AUTHORING_JSON_NUMBER, le=MAX_AUTHORING_JSON_NUMBER)]
    | None
    | list[AuthoringJsonValue]
    | dict[str, AuthoringJsonValue],
    BeforeValidator(_json_kind),
]

_AUTHORING_CONFIG = ConfigDict(strict=True, extra="forbid", allow_inf_nan=False)
Text = Annotated[str, Field(min_length=1)]


@with_config(_AUTHORING_CONFIG)
class AuthoringChoice(TypedDict):
    id: Annotated[str, Field(min_length=1, max_length=80)]
    label: Annotated[str, Field(min_length=1, max_length=200)]
    render_hints: NotRequired[dict[str, AuthoringJsonValue]]
    feedback: NotRequired[AuthoringJsonValue]


@with_config(_AUTHORING_CONFIG)
class AuthoringNode(TypedDict):
    type: Annotated[str, Field(min_length=1, max_length=40)]
    prompt: str
    choices: list[AuthoringChoice]
    render_hints: NotRequired[dict[str, AuthoringJsonValue]]


AuthoringTransition = TypedDict(
    "AuthoringTransition",
    {
        "from": Annotated[list[Text], Field(min_length=2, max_length=2)],
        "to": Text,
        "outcome": NotRequired[Literal["safe", "at_risk", "compromised"]],
        "delta": NotRequired[AuthoringJsonValue],
        "feedback": NotRequired[AuthoringJsonValue],
        "lessons_triggered": NotRequired[AuthoringJsonValue],
    },
)
with_config(_AUTHORING_CONFIG)(AuthoringTransition)


@with_config(_AUTHORING_CONFIG)
class TreeSpecAuthoringDocument(TypedDict):
    start_node: Text
    nodes: dict[str, AuthoringNode]
    transitions: list[AuthoringTransition]
    wire_version: NotRequired[Annotated[int, Field(ge=TREESPEC_WIRE_VERSION, le=TREESPEC_WIRE_VERSION)]]
    _meta: NotRequired[dict[str, AuthoringJsonValue]]
    _ab: NotRequired[AuthoringJsonValue]


_AUTHORING_ADAPTER = TypeAdapter(TreeSpecAuthoringDocument)


def validate_authoring_document(raw: object) -> TreeSpecAuthoringDocument:
    """Validate complete structure without graph lint or host extension rules.

    Raises Pydantic ValidationError. Missing optional keys are not materialized.
    Hosts impose resource limits and product-specific extension schemas separately.
    """
    return _AUTHORING_ADAPTER.validate_python(raw, strict=True)


def authoring_json_schema() -> dict[str, object]:
    """Export the Pydantic authority for generated host request/response contracts."""
    return _AUTHORING_ADAPTER.json_schema()
