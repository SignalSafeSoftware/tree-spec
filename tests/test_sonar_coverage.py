"""Reject misplaced or stale reports before a combined Sonar submission."""
from __future__ import annotations

import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch

from scripts import prepare_sonar_coverage as coverage


class CoveragePathsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.languages = {
            "typescript": self.root / "typescript/src",
            "python": self.root / "python/src/tree_spec",
            "tooling": self.root / "scripts",
        }
        for directory in self.languages.values():
            directory.mkdir(parents=True)
        (self.root / "typescript/coverage").mkdir()
        (self.root / "artifacts/tooling").mkdir(parents=True)
        (self.root / "artifacts/tooling-js").mkdir()
        (self.languages["tooling"] / "check.mjs").write_text("export const checked = true;\n")
        (self.languages["tooling"] / "prepare_sonar_coverage.py").write_text("checked = True\n")
        (self.languages["typescript"] / "parse.ts").write_text("export const valid = true;\n")
        (self.languages["python"] / "__init__.py").write_text("valid = True\n")
        self.enterContext(patch.object(coverage, "ROOT", self.root))
        self.enterContext(patch.object(coverage, "LANGUAGES", self.languages))

    def test_reports_resolve_to_authored_repository_paths(self) -> None:
        lcov = self.root / "typescript/coverage/lcov.info"
        lcov.write_text("TN:\nSF:src/parse.ts\nDA:1,1\nend_of_record\n")
        xml = self.root / "python/coverage.xml"
        xml.write_text('<coverage><sources><source>/old/runner</source></sources><packages>'
                       '<package><classes><class filename="src/tree_spec/__init__.py"><lines>'
                       '<line number="1" hits="1"/>'
                       '</lines></class></classes></package></packages></coverage>')
        (self.root / "artifacts/tooling-js/lcov.info").write_text("SF:scripts/check.mjs\nDA:1,1\nend_of_record\n")
        tooling = self.root / "artifacts/tooling/coverage.xml"
        tooling.write_text('<coverage><sources><source>/old/runner</source></sources><packages>'
                           '<package><classes><class filename="scripts/prepare_sonar_coverage.py"/>'
                           '</classes></package></packages></coverage>')
        for language in self.languages:
            coverage.manifest_path(language).write_text(json.dumps(coverage.source_hashes(language)))
        (self.root / "artifacts/tooling-js/source-sha256.json").write_text(
            json.dumps(coverage.source_hashes("tooling")))
        with patch("sys.argv", ["prepare_sonar_coverage.py"]):
            coverage.main()
        self.assertIn("SF:typescript/src/parse.ts", lcov.read_text())
        tree = ET.parse(xml)
        self.assertEqual(tree.findtext("sources/source"), ".")
        entry = tree.find(".//class")
        self.assertIsNotNone(entry)
        if entry is not None:
            self.assertEqual(entry.attrib["filename"], "python/src/tree_spec/__init__.py")
            line = entry.find("lines/line")
            self.assertIsNotNone(line)
            if line is not None:
                self.assertEqual(line.attrib, {"number": "1", "hits": "1"})

    def test_changed_source_bytes_fail_before_report_modification(self) -> None:
        for language in self.languages:
            coverage.manifest_path(language).write_text(json.dumps(coverage.source_hashes(language)))
        (self.languages["typescript"] / "parse.ts").write_text("changed source")
        with (
            patch("sys.argv", ["prepare_sonar_coverage.py"]),
            self.assertRaisesRegex(ValueError, "source byte mismatch"),
        ):
            coverage.main()

    def test_untrusted_and_missing_report_paths_are_rejected(self) -> None:
        for language, filename in [("python", "../outside.py"), ("python", "/absolute.py"),
                                   ("typescript", "parse.ts"), ("typescript", "src/missing.ts")]:
            with self.subTest(language=language, filename=filename), self.assertRaises(ValueError):
                coverage.checked_path(language, filename)

    def test_empty_source_reports_are_rejected(self) -> None:
        (self.root / "typescript/coverage/lcov.info").write_text("TN:\n")
        (self.root / "python/coverage.xml").write_text("<coverage/>")
        with self.assertRaisesRegex(ValueError, "no source entries"):
            coverage.normalize_lcov()
        with self.assertRaisesRegex(ValueError, "no source entries"):
            coverage.normalize_xml()

    def test_record_mode_captures_exact_bytes_and_invalid_mode_fails(self) -> None:
        with patch("sys.argv", ["prepare_sonar_coverage.py", "record", "typescript"]):
            coverage.main()
        self.assertEqual(json.loads(coverage.manifest_path("typescript").read_text()),
                         coverage.source_hashes("typescript"))
        with patch("sys.argv", ["prepare_sonar_coverage.py", "unexpected"]), self.assertRaises(ValueError):
            coverage.main()

    def test_missing_xml_sources_and_nonpackage_python_path_fail(self) -> None:
        report = self.root / "python/coverage.xml"
        report.write_text('<coverage><packages><package><classes>'
                          '<class filename="src/tree_spec/__init__.py"/>'
                          '</classes></package></packages></coverage>')
        with self.assertRaisesRegex(ValueError, "no sources element"):
            coverage.normalize_xml()
        with self.assertRaisesRegex(ValueError, "Unexpected Python"):
            coverage.checked_path("python", "__init__.py")

    def test_javascript_producer_bytes_must_match_checkout(self) -> None:
        for language in self.languages:
            coverage.manifest_path(language).write_text(json.dumps(coverage.source_hashes(language)))
        (self.root / "artifacts/tooling-js/source-sha256.json").write_text("{}")
        with patch("sys.argv", ["prepare_sonar_coverage.py"]), self.assertRaisesRegex(ValueError, "producer source"):
            coverage.main()


if __name__ == "__main__":
    unittest.main()
