"""Tests for lint_tree_spec edge cases and graph traversal."""

from __future__ import annotations

from deliveryplus_tree_spec import END_NODE_ID
from deliveryplus_tree_spec import TreeSpecBuilder
from deliveryplus_tree_spec import lint_tree_spec


def test_lint_reports_duplicate_transition() -> None:
    raw = {
        "start_node": "s",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Choose",
                "choices": [{"id": "go", "label": "Go"}],
            }
        },
        "transitions": [
            {"from": ["s", "go"], "to": END_NODE_ID, "outcome": "safe"},
            {"from": ["s", "go"], "to": END_NODE_ID, "outcome": "at_risk"},
        ],
    }
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    dupes = [issue for issue in issues if issue.code == "duplicate_transition_source"]
    assert len(dupes) == 1
    assert dupes[0].node_id == "s"
    assert dupes[0].choice_id == "go"


def test_lint_skips_choices_with_transitions() -> None:
    raw = {
        "start_node": "s",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Choose",
                "choices": [
                    {"id": "ok", "label": "OK"},
                    {"id": "missing", "label": "Missing"},
                ],
            }
        },
        "transitions": [{"from": ["s", "ok"], "to": END_NODE_ID, "outcome": "safe"}],
    }
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    missing = [issue for issue in issues if issue.code == "missing_choice_transition"]
    assert len(missing) == 1
    assert missing[0].choice_id == "missing"


def test_lint_reports_missing_target_node() -> None:
    raw = {
        "start_node": "s",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Choose",
                "choices": [{"id": "go", "label": "Go"}],
            }
        },
        "transitions": [{"from": ["s", "go"], "to": "ghost"}],
    }
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    missing_targets = [issue for issue in issues if issue.code == "transition_target_not_found"]
    assert len(missing_targets) == 1
    assert missing_targets[0].node_id == "s"
    assert missing_targets[0].choice_id == "go"


def test_lint_reports_unreachable_node() -> None:
    raw = {
        "start_node": "s",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Start",
                "choices": [{"id": "go", "label": "Go"}],
            },
            "orphan": {
                "type": "prompt",
                "prompt": "Never visited",
                "choices": [],
            },
        },
        "transitions": [{"from": ["s", "go"], "to": END_NODE_ID, "outcome": "safe"}],
    }
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    unreachable = [issue for issue in issues if issue.code == "unreachable_node"]
    assert len(unreachable) == 1
    assert unreachable[0].node_id == "orphan"


def test_lint_reachability_handles_cycles() -> None:
    raw = {
        "start_node": "a",
        "nodes": {
            "a": {
                "type": "prompt",
                "prompt": "A",
                "choices": [
                    {"id": "to_b", "label": "B"},
                    {"id": "to_end", "label": "End"},
                ],
            },
            "b": {
                "type": "prompt",
                "prompt": "B",
                "choices": [{"id": "back", "label": "Back"}],
            },
        },
        "transitions": [
            {"from": ["a", "to_b"], "to": "b"},
            {"from": ["b", "back"], "to": "a"},
            {"from": ["a", "to_end"], "to": END_NODE_ID, "outcome": "safe"},
        ],
    }
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    assert issues == []


def test_lint_reachability_deduplicates_stacked_nodes() -> None:
    raw = {
        "start_node": "a",
        "nodes": {
            "a": {
                "type": "prompt",
                "prompt": "A",
                "choices": [
                    {"id": "one", "label": "One"},
                    {"id": "two", "label": "Two"},
                ],
            },
            "b": {
                "type": "prompt",
                "prompt": "B",
                "choices": [],
            },
        },
        "transitions": [
            {"from": ["a", "one"], "to": "b"},
            {"from": ["a", "two"], "to": "b"},
        ],
    }
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    assert not any(issue.code == "unreachable_node" for issue in issues)


def test_lint_reachability_skips_missing_intermediate_node() -> None:
    raw = {
        "start_node": "s",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Start",
                "choices": [{"id": "go", "label": "Go"}],
            }
        },
        "transitions": [{"from": ["s", "go"], "to": "ghost"}],
    }
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    assert any(issue.code == "transition_target_not_found" for issue in issues)


def test_lint_reports_duplicate_choice_id_with_location() -> None:
    raw = {
        "start_node": "s",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Choose",
                "choices": [
                    {"id": "go", "label": "Go"},
                    {"id": "go", "label": "Again"},
                ],
            }
        },
        "transitions": [
            {"from": ["s", "go"], "to": END_NODE_ID, "outcome": "safe"},
        ],
    }
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    duplicate = next(issue for issue in issues if issue.code == "duplicate_choice_id")
    assert duplicate.node_id == "s"
    assert duplicate.choice_id == "go"
    assert duplicate.path == ("tree_spec", "nodes", "s", "choices", 1, "id")


def test_lint_reports_reachable_nodes_without_terminal_path() -> None:
    raw = {
        "start_node": "s",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Loop",
                "choices": [{"id": "again", "label": "Again"}],
            }
        },
        "transitions": [{"from": ["s", "again"], "to": "s"}],
    }
    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    no_terminal_path = next(issue for issue in issues if issue.code == "no_terminal_path")
    assert no_terminal_path.node_id == "s"
    assert no_terminal_path.path == ("tree_spec", "nodes", "s")


def test_lint_uses_canonical_source_diagnostics_and_severity_alias() -> None:
    raw = {
        "start_node": "missing",
        "nodes": {
            "s": {
                "type": "prompt",
                "prompt": "Choose",
                "choices": [{"id": "known", "label": "Known"}],
            }
        },
        "transitions": [
            {"from": ["unknown", "choice"], "to": END_NODE_ID, "outcome": "safe"},
            {"from": ["s", "unknown"], "to": END_NODE_ID, "outcome": "safe"},
        ],
    }

    issues = lint_tree_spec(TreeSpecBuilder.from_raw(raw))
    codes = {issue.code for issue in issues}
    assert "start_node_not_found" in codes
    assert "transition_node_not_found" in codes
    assert "transition_choice_not_found" in codes
    assert all(issue.severity == issue.level for issue in issues)
