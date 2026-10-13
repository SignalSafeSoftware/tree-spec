"""Apply patch to tree_spec dict. Used when patching tree_spec (e.g. AB variants)."""

from __future__ import annotations
from typing import Any
from typing import Callable
from pydantic import ValidationError as PydanticValidationError
from deliveryplus_tree_spec.models import PatchDict
from deliveryplus_tree_spec.models import TreeSpec

_PATCH_APPLY_ERRORS = (ValueError, TypeError, KeyError, PydanticValidationError)


class PatchApplyError(Exception):
    """Raised when the base spec or patch is invalid; `field` is either `'tree_spec'` or `'patch'`."""

    def __init__(self, field: str, message: str) -> None:
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")


def _run_or_raise_patch_error[T](field: str, action: Callable[[], T]) -> T:
    try:
        return action()
    except _PATCH_APPLY_ERRORS as e:
        raise PatchApplyError(field, str(e)) from e


def apply_patch_to_spec_dict(
    base_spec_dict: dict[str, Any], patch: dict[str, Any]
) -> dict[str, Any]:
    """Parse base tree_spec, validate patch, apply it, return updated spec dict.

    Raises PatchApplyError(field, message) on invalid base (field='tree_spec') or invalid patch (field='patch').
    """
    tree_spec = _run_or_raise_patch_error(
        "tree_spec", lambda: TreeSpec.parse_tree_spec(base_spec_dict)
    )

    patch_model = _run_or_raise_patch_error("patch", lambda: PatchDict.model_validate(patch))

    _run_or_raise_patch_error("patch", lambda: tree_spec.apply_patch(patch_model))

    updated = tree_spec.model_dump(by_alias=True, exclude_none=False)
    if not isinstance(updated, dict):
        raise PatchApplyError("tree_spec", "Internal error: model_dump did not return a mapping.")
    result = dict(base_spec_dict)
    result.update(updated)
    return result
