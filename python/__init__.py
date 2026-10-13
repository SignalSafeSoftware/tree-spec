"""
Reusable TreeSpec contract and validation (backend counterpart to ``packages/tree-spec``).

No , HTTP, or simulator UI — wire models, parsing, lint, and patch helpers only.

See ``README.md`` in this package for scope, dependency rules, and cross-language fixtures
(``contracts/tree-spec/``).
"""

from deliveryplus_tree_spec.builder import TreeSpecBuilder
from deliveryplus_tree_spec.builder import TreeSpecError
from deliveryplus_tree_spec.constants import END_NODE_ID
from deliveryplus_tree_spec.constants import LEGACY_END_NODE_ID
from deliveryplus_tree_spec.constants import TREESPEC_WIRE_VERSION
from deliveryplus_tree_spec.lint import lint_tree_spec
from deliveryplus_tree_spec.lint import TreeSpecIssue
from deliveryplus_tree_spec.models import ABMeta
from deliveryplus_tree_spec.models import ABVariant
from deliveryplus_tree_spec.models import Choice
from deliveryplus_tree_spec.models import Delta
from deliveryplus_tree_spec.models import FeedbackDict
from deliveryplus_tree_spec.models import MicroFeedback
from deliveryplus_tree_spec.models import Node
from deliveryplus_tree_spec.models import PatchDict
from deliveryplus_tree_spec.models import ReplaceMatch
from deliveryplus_tree_spec.models import ReplacePatch
from deliveryplus_tree_spec.models import ReplaceSet
from deliveryplus_tree_spec.models import Transition
from deliveryplus_tree_spec.models import TreeSpec
from deliveryplus_tree_spec.patch import apply_patch_to_spec_dict
from deliveryplus_tree_spec.patch import PatchApplyError

__all__ = [
    "ABMeta",
    "ABVariant",
    "Choice",
    "Delta",
    "END_NODE_ID",
    "FeedbackDict",
    "MicroFeedback",
    "LEGACY_END_NODE_ID",
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
]
