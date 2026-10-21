"""Bind CI coverage to this checkout before combining language reports."""
from __future__ import annotations

import hashlib
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANGUAGES = {
    "typescript": ROOT / "typescript/src",
    "python": ROOT / "python/src/tree_spec",
    "tooling": ROOT / "scripts",
}


def source_hashes(language: str) -> dict[str, str]:
    """Record authored language source bytes, excluding generated caches."""
    suffixes = {".ts"} if language == "typescript" else {".py"}
    if language == "tooling":
        suffixes.add(".mjs")
    roots = [LANGUAGES[language]]
    if language == "tooling":
        roots.append(ROOT / "python/scripts")
    return {
        path.relative_to(ROOT).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for source in roots
        for path in sorted(source.rglob("*"))
        if path.is_file() and path.suffix in suffixes
    }


def manifest_path(language: str) -> Path:
    directories = {"typescript": "typescript/coverage", "python": "python", "tooling": "artifacts/tooling"}
    directory = ROOT / directories[language]
    return directory / "source-sha256.json"


def checked_path(language: str, filename: str) -> str:
    """Resolve only the source layout emitted by the corresponding coverage tool."""
    relative = Path(filename)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError(f"Unsafe {language} coverage path: {filename}")
    if language == "typescript":
        if not filename.startswith("src/"):
            raise ValueError(f"Unexpected TypeScript coverage path: {filename}")
        candidate = ROOT / "typescript" / relative
    elif language == "python":
        if not filename.startswith("src/tree_spec/"):
            raise ValueError(f"Unexpected Python coverage path: {filename}")
        candidate = ROOT / "python" / relative
    else:
        candidate = ROOT / relative
    resolved = candidate.resolve()
    if not resolved.is_relative_to(ROOT) or not resolved.is_file():
        raise ValueError(f"Missing {language} source: {filename}")
    if resolved.relative_to(ROOT).as_posix() not in source_hashes(language):
        raise ValueError(f"Missing {language} source: {filename}")
    return resolved.relative_to(ROOT).as_posix()


def normalize_lcov(language: str = "typescript") -> int:
    reports = {"typescript": "typescript/coverage/lcov.info", "tooling": "artifacts/tooling-js/lcov.info"}
    report = ROOT / reports[language]
    lines = report.read_text().splitlines()
    count = 0
    for index, line in enumerate(lines):
        if line.startswith("SF:"):
            lines[index] = "SF:" + checked_path(language, line[3:])
            count += 1
    if not count:
        raise ValueError("TypeScript coverage has no source entries")
    report.write_text("\n".join(lines) + "\n")
    return count


def normalize_xml(language: str = "python") -> int:
    reports = {"python": "python/coverage.xml", "tooling": "artifacts/tooling/coverage.xml"}
    report = ROOT / reports[language]
    tree = ET.parse(report)
    classes = tree.findall(".//class")
    if not classes:
        raise ValueError("Python coverage has no source entries")
    for entry in classes:
        entry.set("filename", checked_path(language, entry.attrib["filename"]))
    sources = tree.find("sources")
    if sources is None:
        raise ValueError("Python coverage has no sources element")
    sources[:] = []
    ET.SubElement(sources, "source").text = "."
    tree.write(report, encoding="unicode", xml_declaration=True)
    return len(classes)


def main() -> None:
    if len(sys.argv) == 3 and sys.argv[1] == "record" and sys.argv[2] in LANGUAGES:
        language = sys.argv[2]
        manifest_path(language).write_text(json.dumps(source_hashes(language), sort_keys=True) + "\n")
        return
    if len(sys.argv) != 1:
        raise ValueError("Expected no arguments or record <typescript|python|tooling>")
    for language in LANGUAGES:
        expected = source_hashes(language)
        if not expected or json.loads(manifest_path(language).read_text()) != expected:
            raise ValueError(f"Coverage source byte mismatch: {language}")
        print(f"Verified {language}: {len(expected)} authored source files")
    js_manifest = ROOT / "artifacts/tooling-js/source-sha256.json"
    if json.loads(js_manifest.read_text()) != source_hashes("tooling"):
        raise ValueError("JavaScript coverage producer source byte mismatch")
    print(f"Normalized reports: {normalize_lcov()} TypeScript, {normalize_xml()} Python sources, "
          f"{normalize_xml('tooling')} Python tooling, {normalize_lcov('tooling')} JavaScript tooling sources")


if __name__ == "__main__":
    main()
