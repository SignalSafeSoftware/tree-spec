"""Public export contract for deliveryplus_tree_spec."""

from __future__ import annotations

import importlib

import deliveryplus_tree_spec as pkg


def test_public_all_symbols_are_importable() -> None:
    expected = set(pkg.__all__)
    for name in expected:
        assert hasattr(pkg, name), f"missing export: {name}"
        assert getattr(pkg, name) is not None


def test_public_all_matches_package_module() -> None:
    module = importlib.import_module("deliveryplus_tree_spec")
    assert set(module.__all__) == {
        "ABMeta",
        "ABVariant",
        "Choice",
        "Delta",
        "END_NODE_ID",
        "FeedbackDict",
        "LEGACY_END_NODE_ID",
        "MicroFeedback",
        "Node",
        "PatchApplyError",
        "PatchDict",
        "ReplaceMatch",
        "ReplacePatch",
        "ReplaceSet",
        "TREESPEC_WIRE_VERSION",
        "Transition",
        "TreeSpec",
        "TreeSpecBuilder",
        "TreeSpecError",
        "TreeSpecIssue",
        "apply_patch_to_spec_dict",
        "lint_tree_spec",
    }


def test_builder_reports_start_node_id() -> None:
    from deliveryplus_tree_spec import END_NODE_ID
    from deliveryplus_tree_spec import TreeSpecBuilder

    raw = {
        "start_node": "entry",
        "nodes": {
            "entry": {
                "type": "prompt",
                "prompt": "Hi",
                "choices": [{"id": "go", "label": "Go"}],
            }
        },
        "transitions": [{"from": ["entry", "go"], "to": END_NODE_ID, "outcome": "safe"}],
    }
    builder = TreeSpecBuilder.from_raw(raw)
    assert builder.get_start_node_id() == "entry"


def test_micro_feedback_merge_into_dict_partial_and_overwrite() -> None:
    from deliveryplus_tree_spec import MicroFeedback

    target = {"title": "old", "body": "keep"}
    MicroFeedback(key="new-key", takeaway="tip").merge_into_dict(target)
    assert target == {"title": "old", "body": "keep", "key": "new-key", "takeaway": "tip"}


def test_apply_patch_matches_lessons_triggered_feedback_key() -> None:
    from deliveryplus_tree_spec import END_NODE_ID
    from deliveryplus_tree_spec import apply_patch_to_spec_dict

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
                "lessons_triggered": ["lesson-key"],
                "feedback": {"title": "Before"},
            }
        ],
    }

    updated = apply_patch_to_spec_dict(
        base_spec,
        {
            "replace": [
                {
                    "match": {"feedback_key": "lesson-key"},
                    "set": {"title": "After"},
                }
            ]
        },
    )

    assert updated["transitions"][0]["feedback"]["title"] == "After"


def test_ab_variant_round_trip_through_tree_spec() -> None:
    from deliveryplus_tree_spec import ABMeta
    from deliveryplus_tree_spec import ABVariant
    from deliveryplus_tree_spec import TreeSpec

    spec = TreeSpec(
        start_node="s",
        nodes={"s": {"type": "prompt", "prompt": "Hi", "choices": []}},
        transitions=[],
        ab=ABMeta(
            variant_of="scenario-1",
            variant_label="A",
            variants=[ABVariant(id="v1", label="Variant 1", weight=50)],
        ),
    )
    dumped = spec.model_dump(by_alias=True)
    assert dumped["_ab"]["variant_of"] == "scenario-1"
    assert dumped["_ab"]["variant_label"] == "A"
    assert dumped["_ab"]["variants"][0]["id"] == "v1"
    assert dumped["_ab"]["variants"][0]["weight"] == 50

    restored = TreeSpec.model_validate(dumped)
    assert restored.ab is not None
    assert restored.ab.variant_of == "scenario-1"
    assert restored.ab.variants[0].label == "Variant 1"
