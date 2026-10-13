#!/usr/bin/env python3
"""Build wheel/sdist, twine check, install wheel in a clean venv, verify imports."""

from __future__ import annotations

import shutil
# Bandit: subprocess is required for this trusted packaging smoke script (fixed argv lists only).
import subprocess  # nosec B404
import sys
import json
import tarfile
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

IMPORT_MODULES = [
    "deliveryplus_tree_spec",
]

NAMED_IMPORTS: list[tuple[str, list[str]]] = [
    (
        "deliveryplus_tree_spec",
        ["TreeSpec", "lint_tree_spec", "TREESPEC_WIRE_VERSION", "TreeSpecBuilder"],
    ),
]

TYPED_PACKAGE = "deliveryplus_tree_spec"


def run(cmd: list[str], *, cwd: Path | None = None) -> None:
    # Bandit: argv list only; never shell=True; commands are developer-defined in this script.
    subprocess.run(cmd, cwd=cwd or ROOT, check=True, shell=False)  # nosec B603


def main() -> None:
    dist_dir = ROOT / "dist"
    if dist_dir.exists():
        shutil.rmtree(dist_dir)

    run([sys.executable, "-m", "build"])
    wheels = sorted(dist_dir.glob("*.whl"))
    if not wheels:
        raise SystemExit("smoke_package: no wheel produced")
    wheel = wheels[0]

    run([sys.executable, "-m", "twine", "check", "dist/*"])

    verify_sdist_contents(dist_dir)

    venv_dir = Path(tempfile.mkdtemp(prefix="smoke-venv-"))
    try:
        run([sys.executable, "-m", "venv", str(venv_dir)])
        pip = venv_dir / "bin" / "pip"
        run([str(pip), "install", str(wheel)])

        executable = venv_dir / "bin" / "python"
        check = (
            "import importlib; from pathlib import Path; "
            f"modules = {json.dumps(IMPORT_MODULES)}; "
            f"named = {json.dumps(NAMED_IMPORTS)}; "
            "loaded = [importlib.import_module(name) for name in modules]; "
            "assert all('site-packages' in str(Path(module.__file__)) for module in loaded); "
            "assert all(hasattr(importlib.import_module(module), name) "
            "for module, names in named for name in names)"
        )
        run([str(executable), "-I", "-c", check], cwd=venv_dir)

        verify_py_typed(wheel)

        print(f"smoke_package: OK ({wheel.name})")
    finally:
        shutil.rmtree(venv_dir, ignore_errors=True)
        shutil.rmtree(dist_dir, ignore_errors=True)


def verify_sdist_contents(dist_dir: Path) -> None:
    sdists = sorted(dist_dir.glob("*.tar.gz"))
    if not sdists:
        raise SystemExit("smoke_package: no sdist produced")

    with tarfile.open(sdists[0], "r:*") as archive:
        listing = archive.getnames()

    required_suffixes = ("README.md", "LICENSE", "py.typed", "VERSION")
    missing = [
        suffix
        for suffix in required_suffixes
        if not any(path.endswith(suffix) for path in listing)
    ]
    if missing:
        raise SystemExit(f"smoke_package: sdist is missing required files: {missing}")

    test_paths = [entry for entry in listing if "/tests/" in entry or entry.endswith("/tests/")]
    if test_paths:
        raise SystemExit(
            f"smoke_package: sdist contains tests ({len(test_paths)} path(s), e.g. {test_paths[0]})",
        )

    print(f"sdist contents audit OK ({len(listing)} paths)")


def verify_py_typed(wheel: Path) -> None:
    with zipfile.ZipFile(wheel) as archive:
        typed_entries = [name for name in archive.namelist() if name.endswith("/py.typed")]
        if not typed_entries:
            raise SystemExit(f"smoke_package: missing py.typed in {wheel.name}")
        expected_prefix = TYPED_PACKAGE.replace(".", "/") + "/"
        if not any(entry.startswith(expected_prefix) for entry in typed_entries):
            raise SystemExit(
                f"smoke_package: py.typed not found under {TYPED_PACKAGE} in {wheel.name}",
            )


if __name__ == "__main__":
    main()
