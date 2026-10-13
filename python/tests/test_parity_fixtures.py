"""Mirrored TreeSpec contract fixtures — keep aligned with tree-spec/tests/fixtures/."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from deliveryplus_tree_spec import END_NODE_ID
from deliveryplus_tree_spec import TreeSpec
from deliveryplus_tree_spec import TreeSpecBuilder
from deliveryplus_tree_spec import lint_tree_spec
from deliveryplus_tree_spec.constants import TREESPEC_WIRE_VERSION

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def load_fixture(name: str) -> dict[str, Any]:
    with (FIXTURES_DIR / name).open(encoding="utf-8") as handle:
        return json.load(handle)


VALID_FIXTURES = (
    "minimal-valid.json",
    "moderate-valid.json",
    "valid-implicit-wire-version.json",
)


@pytest.mark.parametrize("fixture_name", VALID_FIXTURES)
def test_valid_fixtures_parse_and_lint_clean(fixture_name: str) -> None:
    raw = load_fixture(fixture_name)
    builder = TreeSpecBuilder.from_raw(raw)
    assert lint_tree_spec(builder) == []


def test_minimal_valid_has_choice_to_end() -> None:
    raw = load_fixture("minimal-valid.json")
    spec = TreeSpec.parse_tree_spec(raw)
    start = spec.nodes["s"]
    assert len(start.choices) == 1
    end = next(t for t in spec.transitions if t.to == END_NODE_ID)
    assert end.outcome == "safe"


def test_moderate_valid_multistep_with_feedback() -> None:
    raw = load_fixture("moderate-valid.json")
    spec = TreeSpec.parse_tree_spec(raw)
    assert "middle" in spec.nodes
    end = next(t for t in spec.transitions if t.to == END_NODE_ID)
    assert end.feedback is not None
    assert end.feedback.key == "finish-fb"
    intermediate = next(t for t in spec.transitions if t.to == "middle")
    assert intermediate.feedback is not None
    assert intermediate.feedback.key == "continue-fb"


def test_implicit_wire_version_accepted() -> None:
    raw = load_fixture("valid-implicit-wire-version.json")
    assert "wire_version" not in raw
    spec = TreeSpec.parse_tree_spec(raw)
    assert spec.wire_version is None


def test_explicit_wire_version_current_accepted() -> None:
    raw = load_fixture("minimal-valid.json")
    assert raw["wire_version"] == TREESPEC_WIRE_VERSION
    TreeSpec.parse_tree_spec(raw)


def test_invalid_end_without_outcome_rejected_at_parse() -> None:
    raw = load_fixture("invalid-end-without-outcome.json")
    with pytest.raises(ValidationError, match="outcome"):
        TreeSpec.parse_tree_spec(raw)


def test_invalid_non_end_outcome_rejected_at_parse() -> None:
    raw = load_fixture("invalid-non-end-outcome.json")
    with pytest.raises(ValidationError, match="must not include outcome"):
        TreeSpec.parse_tree_spec(raw)


def test_invalid_unsupported_wire_version_rejected_at_parse() -> None:
    raw = load_fixture("invalid-unsupported-wire-version.json")
    with pytest.raises(ValidationError, match="Unsupported wire_version"):
        TreeSpec.parse_tree_spec(raw)


def test_invalid_boolean_wire_version_rejected_at_parse() -> None:
    raw = load_fixture("invalid-wire-version-boolean.json")
    with pytest.raises(ValidationError, match="wire_version must be an integer"):
        TreeSpec.parse_tree_spec(raw)


def test_lint_missing_target_node_code() -> None:
    raw = load_fixture("invalid-missing-target.json")
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    codes = [issue.code for issue in issues]
    assert "transition_target_not_found" in codes


def test_lint_missing_transition_code() -> None:
    raw = load_fixture("invalid-missing-transition.json")
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    codes = [issue.code for issue in issues]
    assert "missing_choice_transition" in codes


def test_lint_unreachable_node_code() -> None:
    raw = load_fixture("invalid-unreachable-node.json")
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    codes = [issue.code for issue in issues]
    assert "unreachable_node" in codes


def test_lint_duplicate_transition_code() -> None:
    raw = load_fixture("invalid-duplicate-transition.json")
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    codes = [issue.code for issue in issues]
    assert "duplicate_transition_source" in codes
