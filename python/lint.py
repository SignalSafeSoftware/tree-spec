from __future__ import annotations
from dataclasses import dataclass
from typing import List
from typing import Optional
from deliveryplus_tree_spec.builder import TreeSpecBuilder
from deliveryplus_tree_spec.constants import END_NODE_ID


@dataclass(frozen=True)
class TreeSpecIssue:
    level: str  # "error" | "warning"; maps to TypeScript's `severity`
    code: str
    message: str
    node_id: Optional[str] = None
    choice_id: Optional[str] = None
    path: Optional[tuple[str | int, ...]] = None

    @property
    def severity(self) -> str:
        """Return the cross-language severity name used by the TypeScript contract."""

        return self.level


def _tree_path(*parts: str | int) -> tuple[str | int, ...]:
    return ("tree_spec", *parts)


def _build_node_issues(builder: TreeSpecBuilder) -> list[TreeSpecIssue]:
    issues: list[TreeSpecIssue] = []
    for node_id, node in builder.spec.nodes.items():
        node_path = _tree_path("nodes", node_id)
        if not node.choices:
            issues.append(
                TreeSpecIssue(
                    level="error",
                    code="node_without_choices",
                    message=f"Node '{node_id}' must define at least one choice.",
                    node_id=node_id,
                    path=node_path,
                )
            )
        seen: set[str] = set()
        for choice_index, choice in enumerate(node.choices):
            if choice.id in seen:
                issues.append(
                    TreeSpecIssue(
                        level="error",
                        code="duplicate_choice_id",
                        message=f"Choice ID '{choice.id}' is duplicated on node '{node_id}'.",
                        node_id=node_id,
                        choice_id=choice.id,
                        path=_tree_path("nodes", node_id, "choices", choice_index, "id"),
                    )
                )
            seen.add(choice.id)
    return issues


def _build_transition_map(builder: TreeSpecBuilder) -> dict[tuple[str, str], str]:
    return {(transition.from_[0], transition.from_[1]): transition.to for transition in builder.spec.transitions}


def _find_missing_transition_issues(
    builder: TreeSpecBuilder,
    trans_map: dict[tuple[str, str], str],
) -> list[TreeSpecIssue]:
    issues: list[TreeSpecIssue] = []
    for node_id, node in builder.spec.nodes.items():
        for choice_index, choice in enumerate(node.choices):
            if (node_id, choice.id) in trans_map:
                continue
            issues.append(
                TreeSpecIssue(
                    level="error",
                    code="missing_choice_transition",
                    message=f"Missing transition for choice '{choice.id}' on node '{node_id}'.",
                    node_id=node_id,
                    choice_id=choice.id,
                    path=_tree_path("nodes", node_id, "choices", choice_index),
                )
            )
    return issues


def _find_transition_issues(
    builder: TreeSpecBuilder,
    trans_map: dict[tuple[str, str], str],
) -> list[TreeSpecIssue]:
    issues: list[TreeSpecIssue] = []
    seen: set[tuple[str, str]] = set()
    for index, transition in enumerate(builder.spec.transitions):
        from_node, choice_id = transition.from_
        path = _tree_path("transitions", index)
        key = (from_node, choice_id)
        if key in seen:
            issues.append(
                TreeSpecIssue(
                    level="error",
                    code="duplicate_transition_source",
                    message=f"Choice '{choice_id}' on node '{from_node}' has more than one transition.",
                    node_id=from_node,
                    choice_id=choice_id,
                    path=(*path, "from"),
                )
            )
        seen.add(key)
        node = builder.spec.nodes.get(from_node)
        if node is None:
            issues.append(
                TreeSpecIssue(
                    level="error",
                    code="transition_node_not_found",
                    message=f"Transition references unknown source node '{from_node}'.",
                    node_id=from_node,
                    choice_id=choice_id,
                    path=(*path, "from", 0),
                )
            )
        elif not any(choice.id == choice_id for choice in node.choices):
            issues.append(
                TreeSpecIssue(
                    level="error",
                    code="transition_choice_not_found",
                    message=f"Transition references unknown choice '{choice_id}' on node '{from_node}'.",
                    node_id=from_node,
                    choice_id=choice_id,
                    path=(*path, "from", 1),
                )
            )
        if transition.to == END_NODE_ID or transition.to in builder.spec.nodes:
            continue
        issues.append(
            TreeSpecIssue(
                level="error",
                code="transition_target_not_found",
                message=f"Transition target '{transition.to}' is not present in tree_spec.nodes.",
                node_id=from_node,
                choice_id=choice_id,
                path=(*path, "to"),
            )
        )
    return issues


def _collect_reachable_nodes(
    builder: TreeSpecBuilder,
    trans_map: dict[tuple[str, str], str],
) -> set[str]:
    reachable: set[str] = set()
    stack: list[str] = [builder.get_start_node_id()]
    while stack:
        node_id = stack.pop()
        if node_id in reachable:
            continue
        reachable.add(node_id)
        current = builder.spec.nodes.get(node_id)
        if current is None:
            continue
        for choice in current.choices:
            next_node = trans_map.get((node_id, choice.id))
            if not next_node or next_node == END_NODE_ID or next_node in reachable:
                continue
            stack.append(next_node)
    return reachable


def _find_unreachable_node_issues(
    builder: TreeSpecBuilder,
    reachable: set[str],
) -> list[TreeSpecIssue]:
    start_node_id = builder.get_start_node_id()
    return [
        TreeSpecIssue(
            level="warning",
            code="unreachable_node",
            message=f"Node '{node_id}' is unreachable from start node '{start_node_id}'.",
            node_id=node_id,
            path=_tree_path("nodes", node_id),
        )
        for node_id in builder.spec.nodes.keys()
        if node_id not in reachable
    ]


def _find_no_terminal_path_issues(
    builder: TreeSpecBuilder,
    reachable: set[str],
    trans_map: dict[tuple[str, str], str],
) -> list[TreeSpecIssue]:
    reverse: dict[str, set[str]] = {}
    for (from_node, _choice_id), to_node in trans_map.items():
        if to_node == END_NODE_ID:
            reverse.setdefault(END_NODE_ID, set()).add(from_node)
        elif to_node in builder.spec.nodes:
            reverse.setdefault(to_node, set()).add(from_node)

    can_reach_end: set[str] = set()
    pending = list(reverse.get(END_NODE_ID, set()))
    while pending:
        node_id = pending.pop()
        if node_id in can_reach_end:
            continue
        can_reach_end.add(node_id)
        pending.extend(reverse.get(node_id, set()))

    return [
        TreeSpecIssue(
            level="error",
            code="no_terminal_path",
            message=f"Node '{node_id}' has no path to END.",
            node_id=node_id,
            path=_tree_path("nodes", node_id),
        )
        for node_id in sorted(reachable)
        if node_id not in can_reach_end
    ]


def lint_tree_spec(builder: TreeSpecBuilder) -> List[TreeSpecIssue]:
    """Domain linting beyond Pydantic shape validation.

    The TreeSpec models enforce structural invariants, but lints catch authoring mistakes:
    - missing transitions for choices
    - transitions that point to missing nodes
    - unreachable nodes

    Keep these rules stable and re-use them across:
    - seed_demo (--training-content-only)
    - admin validate endpoint
    - publish gating
    """

    trans_map = _build_transition_map(builder)
    reachable = _collect_reachable_nodes(builder, trans_map)
    issues: list[TreeSpecIssue] = []
    if builder.get_start_node_id() not in builder.spec.nodes:
        issues.append(
            TreeSpecIssue(
                level="error",
                code="start_node_not_found",
                message=f"Start node '{builder.get_start_node_id()}' is not present in tree_spec.nodes.",
                node_id=builder.get_start_node_id(),
                path=_tree_path("start_node"),
            )
        )

    issues.extend(_build_node_issues(builder))
    issues.extend(_find_transition_issues(builder, trans_map))
    issues.extend(_find_missing_transition_issues(builder, trans_map))
    issues.extend(_find_unreachable_node_issues(builder, reachable))
    issues.extend(_find_no_terminal_path_issues(builder, reachable, trans_map))
    return issues
