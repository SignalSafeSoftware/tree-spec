"""Audit both distribution boundaries and mirrored wire fixtures."""

from pathlib import Path
import sys
import tarfile
import zipfile
from typing import BinaryIO

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    if len(sys.argv) != 1:
        raise ValueError("Pass packed npm archive bytes on stdin; filesystem arguments are not accepted")
    typescript = {p.name: p.read_bytes() for p in (ROOT / "typescript/tests/fixtures").glob("*.json")}
    python = {p.name: p.read_bytes() for p in (ROOT / "python/tests/fixtures").glob("*.json")}
    if not typescript or typescript != python:
        raise ValueError("TreeSpec language fixtures have drifted")
    check_npm_archive(sys.stdin.buffer)
    wheels = list((ROOT / "python/dist").glob("*.whl"))
    sdists = list((ROOT / "python/dist").glob("*.tar.gz"))
    if not wheels or not sdists:
        raise ValueError("Build Python wheel and sdist before auditing")
    for wheel in wheels:
        with zipfile.ZipFile(wheel) as archive:
            names = archive.namelist()
            if "tree_spec/__init__.py" not in names:
                raise ValueError("Python wheel lost its public import")
            if "tree_spec/py.typed" not in names:
                raise ValueError("Python wheel lost its typing marker")
            reject_javascript(names)
    for sdist in sdists:
        with tarfile.open(sdist) as archive:
            reject_javascript(archive.getnames())
    print(f"Distribution boundaries and {len(python)} shared wire fixtures passed")


def check_npm_archive(stream: BinaryIO) -> None:
    """Inspect archive bytes without accepting filesystem paths or extracting members."""
    with tarfile.open(fileobj=stream, mode="r|gz") as archive:
        names = archive.getnames()
        if "package/dist/index.js" not in names or "package/dist/index.d.ts" not in names:
            raise ValueError("npm archive is missing the public JavaScript/types entry")
        if any("/python/" in name or name.endswith((".py", ".whl")) for name in names):
            raise ValueError("npm archive contains Python implementation")


def reject_javascript(names: list[str]) -> None:
    if any(name.endswith((".ts", ".tsx", ".js", ".mjs", ".tgz")) or "/node_modules/" in name for name in names):
        raise ValueError("Python distribution contains JavaScript implementation")


if __name__ == "__main__":
    main()
