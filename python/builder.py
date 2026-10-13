"""Parse and navigate TreeSpec; no DB, API, or training heuristics."""

from __future__ import annotations
from typing import Any
from typing import Dict
from typing import Optional
from pydantic import ValidationError as PydanticValidationError
from deliveryplus_tree_spec.models import ABMeta
from deliveryplus_tree_spec.models import MicroFeedback
from deliveryplus_tree_spec.models import Node
from deliveryplus_tree_spec.models import Transition
from deliveryplus_tree_spec.models import TreeSpec

_TREE_SPEC_PARSE_ERRORS = (ValueError, TypeError, KeyError, PydanticValidationError)


class TreeSpecError(Exception):
    """TreeSpec is malformed or internally inconsistent."""


class TreeSpecBuilder:
    """
    Pure TreeSpec domain logic.

    - Parses and validates TreeSpec
    - Resolves nodes, choices, transitions
    - Extracts micro-feedback

    Training/simulator heuristics (e.g. inferring flags from choice id) live in
    `vega.common.tree_spec.builder`, which extends this class.
    """

    def __init__(self, spec: TreeSpec):
        self.spec = spec

    @staticmethod
    def _parse_tree_spec_or_none(raw: Dict[str, Any]) -> Optional[TreeSpec]:
        try:
            return TreeSpec.parse_tree_spec(raw)
        except _TREE_SPEC_PARSE_ERRORS:
            return None

    @classmethod
    def from_raw(cls, raw: Dict[str, Any]) -> "TreeSpecBuilder":
        try:
            spec = TreeSpec.parse_tree_spec(raw)
        except _TREE_SPEC_PARSE_ERRORS as e:
            raise TreeSpecError(f"Invalid tree_spec: {e}") from e
        return cls(spec)

    def get_start_node_id(self) -> str:
        return str(self.spec.start_node)

    def get_node(self, node_id: str) -> Node:
        try:
            return self.spec.get_node(node_id)
        except KeyError as e:
            raise TreeSpecError(str(e)) from e

    def choice_exists(self, node: Node, choice_id: str) -> bool:
        return any(c.id == choice_id for c in node.choices)

    def find_transition(self, node_id: str, choice_id: str) -> Transition:
        for t in self.spec.transitions:
            if t.from_[0] == node_id and t.from_[1] == choice_id:
                return t
        raise TreeSpecError(f"Missing transition for ({node_id}, {choice_id})")

    def extract_micro_feedback(
        self, *, node_id: str, choice_id: str, transition: Transition
    ) -> Optional[MicroFeedback]:
        if transition.feedback:
            return transition.feedback
        node = self.get_node(node_id)
        for c in node.choices:
            if c.id == choice_id:
                return c.feedback
        return None

    @staticmethod
    def get_ab_meta_from_spec(spec_dict: Dict[str, Any]) -> ABMeta:
        """Get A/B metadata from tree_spec dict as ABMeta model."""
        tree_spec = TreeSpecBuilder._parse_tree_spec_or_none(spec_dict)
        if tree_spec is None:
            return ABMeta()
        return tree_spec.ab or ABMeta()

    @staticmethod
    def update_spec_with_ab_meta(spec_dict: Dict[str, Any], ab_meta: ABMeta) -> None:
        """Update tree_spec dict with ABMeta. Writes canonical key '_ab' only."""
        tree_spec = TreeSpecBuilder._parse_tree_spec_or_none(spec_dict)
        if tree_spec is not None:
            tree_spec.ab = ab_meta
            serialized = tree_spec.model_dump(by_alias=True, exclude_none=False).get("_ab")
            spec_dict["_ab"] = serialized
            return
        serialized = ab_meta.model_dump(exclude_none=True)
        spec_dict["_ab"] = serialized
