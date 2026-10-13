"""Guardrails: `deliveryplus_tree_spec` must stay free of app-layer framework imports."""

from __future__ import annotations

import ast
from pathlib import Path

_PKG = Path(__file__).resolve().parent.parent

_ORM_FRAMEWORK_ROOT = "dj" + "ango"

_FORBIDDEN_ROOTS = frozenset(
    {
        _ORM_FRAMEWORK_ROOT,
        "rest_framework",
        "celery",
        "vega",
    }
)


def _violations_in_file(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    bad: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".", 1)[0]
                if root in _FORBIDDEN_ROOTS:
                    bad.append(alias.name)
        elif isinstance(node, ast.ImportFrom) and node.module:
            root = node.module.split(".", 1)[0]
            if root in _FORBIDDEN_ROOTS:
                bad.append(node.module)
    return bad


def test_deliveryplus_tree_spec_has_no_framework_or_app_imports() -> None:
    assert _PKG.is_dir(), f"missing package: {_PKG}"
    for path in sorted(_PKG.glob("*.py")):
        if path.name == "__pycache__":
            continue
        violations = _violations_in_file(path)
        assert not violations, f"{path.name}: forbidden imports {violations}"
