"""Pydantic models for the TreeSpec JSON contract (backend counterpart to `packages/tree-spec`)."""

from __future__ import annotations
from typing import Any
from typing import cast
from typing import Dict
from typing import List
from typing import Literal
from typing import Optional
from typing import Tuple
from pydantic import BaseModel
from pydantic import ConfigDict
from pydantic import Field
from pydantic import field_validator
from pydantic import model_validator
from deliveryplus_tree_spec.constants import END_NODE_ID
from deliveryplus_tree_spec.constants import LEGACY_END_NODE_ID
from deliveryplus_tree_spec.constants import TREESPEC_WIRE_VERSION

# JSON-shaped values for API helpers (avoid coupling to app-wide JSON types).
JSONValue = Any
JSONObject = dict[str, JSONValue]


class MicroFeedback(BaseModel):
    model_config = ConfigDict(extra="ignore")

    key: Optional[str] = Field(default=None, max_length=80)
    title: Optional[str] = Field(default=None, max_length=120)
    body: Optional[str] = Field(default=None, max_length=500)
    takeaway: Optional[str] = Field(default=None, max_length=140)
    red_flags: Optional[List[str]] = Field(default=None, max_length=6)

    def feedback_key(self) -> str:
        """Return the feedback key truncated to 80 characters."""
        return (self.key or "")[:80]

    def feedback_title(self) -> str:
        """Return the feedback title truncated to 120 characters."""
        return (self.title or "")[:120]

    def merge_into_dict(self, target: Dict[str, str]) -> None:
        """Merge feedback fields (key, title, body, takeaway, red_flags) into target dict."""
        data = self.model_dump(exclude_none=True)
        for k in ("key", "title", "body", "takeaway", "red_flags"):
            if k in data:
                target[k] = data[k]


class Delta(BaseModel):
    model_config = ConfigDict(extra="ignore")

    total: int = 0
    awareness: int = 0
    verification: int = 0
    impulse_control: int = 0
    damage_containment: int = 0

    def to_dict(self) -> JSONObject:
        """Convert to dictionary format."""
        return cast(
            JSONObject,
            {
                "total": int(self.total),
                "awareness": int(self.awareness),
                "verification": int(self.verification),
                "impulse_control": int(self.impulse_control),
                "damage_containment": int(self.damage_containment),
            },
        )


class Choice(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=200)
    render_hints: Optional[Dict[str, object]] = None
    feedback: Optional[MicroFeedback] = None


class Node(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: str = Field(default="prompt", max_length=40)
    prompt: str = Field(default="")
    render_hints: Dict[str, object] = Field(default_factory=dict)
    choices: List[Choice] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_options(cls, value: object) -> object:
        """Normalize TypeScript's legacy ``options`` collection to ``choices``."""

        if not isinstance(value, dict):
            return value

        normalized = dict(value)
        choices = normalized.get("choices")
        options = normalized.get("options")
        if not choices and options is not None:
            normalized["choices"] = options
        normalized.pop("options", None)
        return normalized

    def to_api(self, node_id: str) -> JSONObject:
        """Convert Node to API response format."""
        return {
            "id": node_id,
            "type": self.type,
            "prompt": self.prompt,
            "choices": [{"id": c.id, "label": c.label} for c in self.choices],
            "render_hints": cast(JSONValue, self.render_hints),
        }


TransitionFrom = Tuple[str, str]


class Transition(BaseModel):
    model_config = ConfigDict(extra="ignore")

    from_: TransitionFrom = Field(alias="from")
    to: str
    outcome: Optional[Literal["safe", "at_risk", "compromised"]] = None
    delta: Delta = Field(default_factory=Delta)
    feedback: Optional[MicroFeedback] = None
    lessons_triggered: Optional[List[str]] = None

    @field_validator("to", mode="before")
    @classmethod
    def normalize_legacy_end_node(cls, value: object) -> object:
        """Normalize the legacy synthetic terminal id used by older TS exports."""

        return END_NODE_ID if value == LEGACY_END_NODE_ID else value

    @model_validator(mode="after")
    def validate_end_outcome(self) -> "Transition":
        if self.to == END_NODE_ID and self.outcome is None:
            raise ValueError(f"Transition to {END_NODE_ID} must include outcome.")
        if self.to != END_NODE_ID and self.outcome is not None:
            raise ValueError(f"Non-{END_NODE_ID} transition must not include outcome.")
        return self

    def get_feedback_key(self) -> str:
        """Get feedback key from transition feedback or first lesson."""
        if self.feedback and self.feedback.key:
            return self.feedback.key.strip()
        if self.lessons_triggered:
            return str(self.lessons_triggered[0] or "").strip()
        return ""

    def apply_feedback_patch(self, set_data: "ReplaceSet") -> None:
        """Apply feedback patch data to this transition."""
        if self.feedback:
            # Update existing feedback with non-None values
            if set_data.title is not None:
                self.feedback.title = set_data.title
            if set_data.body is not None:
                self.feedback.body = set_data.body
            if set_data.takeaway is not None:
                self.feedback.takeaway = set_data.takeaway
            if set_data.key is not None:
                self.feedback.key = set_data.key
            if set_data.red_flags is not None:
                self.feedback.red_flags = set_data.red_flags
        else:
            # Create new feedback from set_data
            feedback_data = set_data.model_dump(exclude_none=True)
            if feedback_data:
                self.feedback = MicroFeedback(**feedback_data)


class ABVariant(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    label: str
    version: Optional[int] = None
    created_on: Optional[str] = None
    weight: int = Field(ge=0, le=100)
    patch: Dict[str, object] = Field(default_factory=dict)


class ABMeta(BaseModel):
    model_config = ConfigDict(extra="ignore")

    variant_of: Optional[str] = None
    variant_label: Optional[str] = None
    variants: List[ABVariant] = Field(default_factory=list)


class TreeSpec(BaseModel):
    """
    Canonical TreeSpec model.

    Runtime invariants:
    - nodes is Dict[str, Node] (object keyed by node id). List format is no longer accepted.
    - JSON keys "_ab" / "_meta" are mapped to fields "ab" / "meta" (aliases).
    - Optional ``wire_version`` must equal :data:`TREESPEC_WIRE_VERSION` when present;
    omitted means implicit v1 (aligned with TypeScript ``packages/tree-spec``).
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True, serialize_by_alias=True)

    wire_version: Optional[int] = Field(
        default=None,
        description="Wire format revision; omit for implicit v1.",
    )
    start_node: str = Field(min_length=1)
    nodes: Dict[str, Node] = Field(default_factory=dict)
    transitions: List[Transition] = Field(default_factory=list)

    ab: Optional[ABMeta] = Field(default=None, alias="_ab")
    meta: Dict[str, object] = Field(default_factory=dict, alias="_meta")

    @field_validator("wire_version", mode="before")
    @classmethod
    def _validate_wire_version(cls, v: object) -> object:
        """Reject unsupported or malformed wire_version (must match TS contract tests)."""
        if v is None:
            return None
        if isinstance(v, bool):
            raise ValueError("wire_version must be an integer when present.")
        if isinstance(v, int):
            iv = v
        elif isinstance(v, float) and v.is_integer():
            iv = int(v)
        else:
            raise ValueError("wire_version must be an integer when present.")
        if iv != TREESPEC_WIRE_VERSION:
            raise ValueError(
                f"Unsupported wire_version {iv}; only {TREESPEC_WIRE_VERSION} is supported."
            )
        return iv

    @staticmethod
    def parse_tree_spec(raw: Dict[str, Any]) -> "TreeSpec":
        return TreeSpec.model_validate(raw)

    def get_node(self, node_id: str) -> Node:
        node = self.nodes.get(node_id)
        if node is None:
            raise KeyError(f"Missing node '{node_id}'")
        return node

    def apply_patch(self, patch: "PatchDict") -> None:
        """Apply a patch to tree_spec transitions."""
        if not patch.replace:
            return

        # Apply patches to transitions
        for replace_item in patch.replace:
            target_key = replace_item.match.feedback_key.strip()
            if not target_key:
                continue

            for transition in self.transitions:
                # Check if this transition matches the target feedback key
                if transition.get_feedback_key() != target_key:
                    continue

                # Apply feedback patch
                transition.apply_feedback_patch(replace_item.set)


# Legacy compatibility models (AB patch system)
class FeedbackDict(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    takeaway: Optional[str] = None
    key: Optional[str] = None
    red_flags: Optional[List[str]] = None
    model_config = ConfigDict(extra="ignore")


class ReplaceMatch(BaseModel):
    feedback_key: str
    model_config = ConfigDict(extra="ignore")


class ReplaceSet(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    takeaway: Optional[str] = None
    key: Optional[str] = None
    red_flags: Optional[List[str]] = None
    model_config = ConfigDict(extra="ignore")


class ReplacePatch(BaseModel):
    match: ReplaceMatch
    set: ReplaceSet
    model_config = ConfigDict(extra="ignore")


class PatchDict(BaseModel):
    replace: Optional[List[ReplacePatch]] = None
    model_config = ConfigDict(extra="ignore")
