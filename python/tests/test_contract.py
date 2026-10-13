"""Focused tests for the standalone `deliveryplus_tree_spec` package (contract + lint)."""

from __future__ import annotations

import pytest

from deliveryplus_tree_spec import END_NODE_ID
from deliveryplus_tree_spec import PatchApplyError
from deliveryplus_tree_spec import TreeSpec
from deliveryplus_tree_spec import TreeSpecBuilder
from deliveryplus_tree_spec import apply_patch_to_spec_dict
from deliveryplus_tree_spec import lint_tree_spec
from deliveryplus_tree_spec.models import ABMeta


def test_parse_minimal_tree_spec() -> None:
    raw = {
        "start_node": "s",
        "nodes": {"s": {"type": "prompt", "prompt": "Hi", "choices": []}},
        "transitions": [],
    }
    spec = TreeSpec.parse_tree_spec(raw)
    assert spec.start_node == "s"
    assert "s" in spec.nodes


def test_end_node_constant_matches_transition_guard() -> None:
    raw = {
        "start_node": "s",
        "nodes": {"s": {"type": "prompt", "prompt": "Hi", "choices": [{"id": "x", "label": "X"}]}},
        "transitions": [{"from": ["s", "x"], "to": END_NODE_ID, "outcome": "safe"}],
    }
    spec = TreeSpec.parse_tree_spec(raw)
    assert spec.transitions[0].to == END_NODE_ID


def test_lint_reports_missing_transition() -> None:
    raw = {
        "start_node": "s",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Choose",
                "choices": [{"id": "click", "label": "Go"}],
            }
        },
        "transitions": [],
    }
    builder = TreeSpecBuilder.from_raw(raw)
    issues = lint_tree_spec(builder)
    assert any(i.code == "missing_choice_transition" for i in issues)


def test_get_ab_meta_from_invalid_spec_returns_empty_model() -> None:
    ab_meta = TreeSpecBuilder.get_ab_meta_from_spec({"not": "a tree spec"})

    assert ab_meta == ABMeta()


def test_update_spec_with_ab_meta_writes_canonical_alias_for_invalid_spec() -> None:
    spec_dict: dict[str, object] = {"not": "a tree spec"}

    TreeSpecBuilder.update_spec_with_ab_meta(
        spec_dict,
        ABMeta(variant_of="scenario-1", variant_label="Variant A"),
    )

    assert spec_dict["_ab"] == {
        "variant_of": "scenario-1",
        "variant_label": "Variant A",
        "variants": [],
    }


def test_apply_patch_to_spec_dict_updates_matching_feedback() -> None:
    base_spec = {
        "start_node": "s",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Choose",
                "choices": [{"id": "click", "label": "Go"}],
            }
        },
        "transitions": [
            {
                "from": ["s", "click"],
                "to": END_NODE_ID,
                "outcome": "safe",
                "feedback": {"key": "safe-click", "title": "Before"},
            }
        ],
    }

    updated = apply_patch_to_spec_dict(
        base_spec,
        {
            "replace": [
                {
                    "match": {"feedback_key": "safe-click"},
                    "set": {"title": "After"},
                }
            ]
        },
    )

    assert updated["transitions"][0]["feedback"]["title"] == "After"
    assert updated["transitions"][0]["feedback"]["key"] == "safe-click"


def test_apply_patch_to_spec_dict_rejects_invalid_base_spec() -> None:
    with pytest.raises(PatchApplyError) as exc_info:
        apply_patch_to_spec_dict({"not": "a tree spec"}, {"replace": []})

    assert exc_info.value.field == "tree_spec"


def test_apply_patch_to_spec_dict_rejects_invalid_patch_shape() -> None:
    base_spec = {
        "start_node": "s",
        "nodes": {"s": {"type": "prompt", "prompt": "Hi", "choices": []}},
        "transitions": [],
    }

    with pytest.raises(PatchApplyError) as exc_info:
        apply_patch_to_spec_dict(base_spec, {"replace": [{"match": {}, "set": {}}]})

    assert exc_info.value.field == "patch"


def test_apply_patch_to_spec_dict_raises_when_dump_not_mapping(monkeypatch) -> None:
    base_spec = {
        "start_node": "s",
        "nodes": {"s": {"type": "prompt", "prompt": "Hi", "choices": []}},
        "transitions": [],
    }

    def bad_dump(*_args, **_kwargs):
        return "not-a-dict"

    monkeypatch.setattr(TreeSpec, "model_dump", bad_dump)

    with pytest.raises(PatchApplyError) as exc_info:
        apply_patch_to_spec_dict(base_spec, {})

    assert exc_info.value.field == "tree_spec"
    assert "Internal error" in exc_info.value.message
