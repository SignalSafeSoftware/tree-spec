"""Tests for model helpers, validation edge cases, and TreeSpecBuilder navigation."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from deliveryplus_tree_spec import END_NODE_ID
from deliveryplus_tree_spec import TREESPEC_WIRE_VERSION
from deliveryplus_tree_spec import TreeSpec
from deliveryplus_tree_spec import TreeSpecBuilder
from deliveryplus_tree_spec import TreeSpecError
from deliveryplus_tree_spec.builder import TreeSpecBuilder as BuilderClass
from deliveryplus_tree_spec.models import ABMeta
from deliveryplus_tree_spec.models import Delta
from deliveryplus_tree_spec.models import MicroFeedback
from deliveryplus_tree_spec.models import Node
from deliveryplus_tree_spec.models import PatchDict
from deliveryplus_tree_spec.models import ReplaceMatch
from deliveryplus_tree_spec.models import ReplacePatch
from deliveryplus_tree_spec.models import ReplaceSet
from deliveryplus_tree_spec.models import Transition


def _minimal_raw() -> dict[str, object]:
    return {
        "start_node": "s",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Choose",
                "choices": [{"id": "go", "label": "Go"}],
            }
        },
        "transitions": [
            {
                "from": ["s", "go"],
                "to": END_NODE_ID,
                "outcome": "safe",
                "feedback": {"key": "fb-key", "title": "Title"},
            }
        ],
    }


def test_micro_feedback_truncation_helpers() -> None:
    assert MicroFeedback().feedback_key() == ""
    assert MicroFeedback().feedback_title() == ""
    feedback = MicroFeedback(key="abc", title="title")
    assert feedback.feedback_key() == "abc"
    assert feedback.feedback_title() == "title"


def test_micro_feedback_merge_into_dict() -> None:
    target: dict[str, object] = {}
    MicroFeedback(
        key="key",
        title="title",
        body="body",
        takeaway="takeaway",
        red_flags=["flag"],
    ).merge_into_dict(target)
    assert target == {
        "key": "key",
        "title": "title",
        "body": "body",
        "takeaway": "takeaway",
        "red_flags": ["flag"],
    }


def test_delta_to_dict() -> None:
    delta = Delta(
        total=10,
        awareness=1,
        verification=2,
        impulse_control=3,
        damage_containment=4,
    )
    assert delta.to_dict() == {
        "total": 10,
        "awareness": 1,
        "verification": 2,
        "impulse_control": 3,
        "damage_containment": 4,
    }


def test_node_to_api() -> None:
    node = Node(
        type="prompt",
        prompt="Hello",
        choices=[{"id": "a", "label": "A"}],
        render_hints={"theme": "dark"},
    )
    assert node.to_api("node-1") == {
        "id": "node-1",
        "type": "prompt",
        "prompt": "Hello",
        "choices": [{"id": "a", "label": "A"}],
        "render_hints": {"theme": "dark"},
    }


def test_transition_end_node_requires_outcome() -> None:
    with pytest.raises(ValidationError, match="must include outcome"):
        Transition.model_validate({"from": ["s", "x"], "to": END_NODE_ID})


def test_transition_non_end_must_not_include_outcome() -> None:
    with pytest.raises(ValidationError, match="must not include outcome"):
        Transition.model_validate(
            {"from": ["s", "x"], "to": "next", "outcome": "safe"}
        )


def test_transition_get_feedback_key_prefers_feedback() -> None:
    transition = Transition.model_validate(
        {
            "from": ["s", "x"],
            "to": END_NODE_ID,
            "outcome": "safe",
            "feedback": {"key": "  fb  "},
            "lessons_triggered": ["lesson"],
        }
    )
    assert transition.get_feedback_key() == "fb"


def test_transition_get_feedback_key_falls_back_to_lesson() -> None:
    transition = Transition.model_validate(
        {
            "from": ["s", "x"],
            "to": END_NODE_ID,
            "outcome": "safe",
            "lessons_triggered": ["  lesson-1  "],
        }
    )
    assert transition.get_feedback_key() == "lesson-1"


def test_transition_get_feedback_key_empty() -> None:
    transition = Transition.model_validate(
        {"from": ["s", "x"], "to": END_NODE_ID, "outcome": "safe"}
    )
    assert transition.get_feedback_key() == ""


def test_transition_apply_feedback_patch_updates_existing() -> None:
    transition = Transition.model_validate(
        {
            "from": ["s", "x"],
            "to": END_NODE_ID,
            "outcome": "safe",
            "feedback": {"key": "k", "title": "Old"},
        }
    )
    transition.apply_feedback_patch(
        ReplaceSet(title="New", body="Body", takeaway="Tip", key="k2", red_flags=["x"])
    )
    assert transition.feedback is not None
    assert transition.feedback.title == "New"
    assert transition.feedback.body == "Body"
    assert transition.feedback.takeaway == "Tip"
    assert transition.feedback.key == "k2"
    assert transition.feedback.red_flags == ["x"]


def test_transition_apply_feedback_patch_creates_new() -> None:
    transition = Transition.model_validate(
        {"from": ["s", "x"], "to": END_NODE_ID, "outcome": "safe"}
    )
    transition.apply_feedback_patch(ReplaceSet(title="Created", key="new-key"))
    assert transition.feedback is not None
    assert transition.feedback.title == "Created"
    assert transition.feedback.key == "new-key"


@pytest.mark.parametrize(
    ("wire_version", "message"),
    [
        (True, "wire_version must be an integer"),
        ("bad", "wire_version must be an integer"),
        (2, "Unsupported wire_version"),
    ],
)
def test_tree_spec_rejects_invalid_wire_version(wire_version: object, message: str) -> None:
    raw = _minimal_raw()
    raw["wire_version"] = wire_version
    with pytest.raises(ValidationError, match=message):
        TreeSpec.model_validate(raw)


def test_tree_spec_accepts_valid_wire_version() -> None:
    raw = _minimal_raw()
    raw["wire_version"] = TREESPEC_WIRE_VERSION
    spec = TreeSpec.model_validate(raw)
    assert spec.wire_version == TREESPEC_WIRE_VERSION


def test_tree_spec_accepts_integer_float_wire_version() -> None:
    raw = _minimal_raw()
    raw["wire_version"] = float(TREESPEC_WIRE_VERSION)
    spec = TreeSpec.model_validate(raw)
    assert spec.wire_version == TREESPEC_WIRE_VERSION


def test_tree_spec_get_node_raises_for_missing() -> None:
    spec = TreeSpec.model_validate(_minimal_raw())
    with pytest.raises(KeyError, match="Missing node 'missing'"):
        spec.get_node("missing")


def test_tree_spec_apply_patch_noop_when_replace_empty() -> None:
    spec = TreeSpec.model_validate(_minimal_raw())
    original_title = spec.transitions[0].feedback.title  # type: ignore[union-attr]
    spec.apply_patch(PatchDict(replace=None))
    spec.apply_patch(PatchDict(replace=[]))
    assert spec.transitions[0].feedback.title == original_title  # type: ignore[union-attr]


def test_tree_spec_apply_patch_skips_non_matching_transitions() -> None:
    spec = TreeSpec.model_validate(_minimal_raw())
    spec.apply_patch(
        PatchDict(
            replace=[
                ReplacePatch(
                    match=ReplaceMatch(feedback_key="other-key"),
                    set=ReplaceSet(title="Ignored"),
                )
            ]
        )
    )
    assert spec.transitions[0].feedback.title == "Title"  # type: ignore[union-attr]


def test_tree_spec_accepts_explicit_null_wire_version() -> None:
    raw = _minimal_raw()
    raw["wire_version"] = None
    spec = TreeSpec.model_validate(raw)
    assert spec.wire_version is None


def test_tree_spec_apply_patch_skips_blank_feedback_key() -> None:
    spec = TreeSpec.model_validate(_minimal_raw())
    spec.apply_patch(
        PatchDict(
            replace=[
                ReplacePatch(
                    match=ReplaceMatch(feedback_key="   "),
                    set=ReplaceSet(title="Ignored"),
                )
            ]
        )
    )
    assert spec.transitions[0].feedback.title == "Title"  # type: ignore[union-attr]


def test_tree_spec_builder_from_raw_raises_on_invalid_spec() -> None:
    with pytest.raises(TreeSpecError, match="Invalid tree_spec"):
        TreeSpecBuilder.from_raw({"not": "a tree spec"})


def test_tree_spec_builder_get_node_wraps_key_error() -> None:
    builder = TreeSpecBuilder.from_raw(_minimal_raw())
    with pytest.raises(TreeSpecError, match="Missing node"):
        builder.get_node("missing")


def test_tree_spec_builder_choice_exists() -> None:
    builder = TreeSpecBuilder.from_raw(_minimal_raw())
    node = builder.get_node("s")
    assert builder.choice_exists(node, "go") is True
    assert builder.choice_exists(node, "missing") is False


def test_tree_spec_builder_find_transition() -> None:
    builder = TreeSpecBuilder.from_raw(_minimal_raw())
    transition = builder.find_transition("s", "go")
    assert transition.to == END_NODE_ID


def test_tree_spec_builder_find_transition_missing() -> None:
    builder = TreeSpecBuilder.from_raw(_minimal_raw())
    with pytest.raises(TreeSpecError, match="Missing transition"):
        builder.find_transition("s", "missing")


def test_tree_spec_builder_extract_micro_feedback_from_transition() -> None:
    builder = TreeSpecBuilder.from_raw(_minimal_raw())
    transition = builder.find_transition("s", "go")
    feedback = builder.extract_micro_feedback(
        node_id="s", choice_id="go", transition=transition
    )
    assert feedback is not None
    assert feedback.key == "fb-key"


def test_tree_spec_builder_extract_micro_feedback_from_choice() -> None:
    raw = {
        "start_node": "s",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Choose",
                "choices": [
                    {
                        "id": "go",
                        "label": "Go",
                        "feedback": {"key": "choice-fb", "title": "Choice"},
                    }
                ],
            }
        },
        "transitions": [{"from": ["s", "go"], "to": END_NODE_ID, "outcome": "safe"}],
    }
    builder = TreeSpecBuilder.from_raw(raw)
    transition = builder.find_transition("s", "go")
    feedback = builder.extract_micro_feedback(
        node_id="s", choice_id="go", transition=transition
    )
    assert feedback is not None
    assert feedback.key == "choice-fb"


def test_tree_spec_builder_extract_micro_feedback_returns_none_when_choice_missing() -> None:
    raw = {
        "start_node": "s",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Choose",
                "choices": [{"id": "go", "label": "Go"}],
            }
        },
        "transitions": [{"from": ["s", "go"], "to": END_NODE_ID, "outcome": "safe"}],
    }
    builder = TreeSpecBuilder.from_raw(raw)
    transition = builder.find_transition("s", "go")
    assert (
        builder.extract_micro_feedback(
            node_id="s", choice_id="missing", transition=transition
        )
        is None
    )


def test_tree_spec_builder_get_ab_meta_from_valid_spec() -> None:
    raw = _minimal_raw()
    raw["_ab"] = {"variant_of": "base", "variant_label": "A", "variants": []}
    ab_meta = TreeSpecBuilder.get_ab_meta_from_spec(raw)
    assert ab_meta.variant_of == "base"
    assert ab_meta.variant_label == "A"


def test_tree_spec_builder_update_spec_with_ab_meta_on_valid_spec() -> None:
    spec_dict = _minimal_raw()
    ab_meta = ABMeta(variant_of="scenario-1", variant_label="Variant A")
    TreeSpecBuilder.update_spec_with_ab_meta(spec_dict, ab_meta)
    assert spec_dict["_ab"] == {
        "variant_of": "scenario-1",
        "variant_label": "Variant A",
        "variants": [],
    }


def test_tree_spec_builder_parse_tree_spec_or_none_returns_none() -> None:
    assert BuilderClass._parse_tree_spec_or_none({"bad": "spec"}) is None
