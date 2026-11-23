"""Packaging tooling rejects incomplete artifacts and unsupported schema features."""

from __future__ import annotations

import contextlib
import io
from pathlib import Path
import runpy
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from python.scripts import check_distributions as distributions
from python.scripts import smoke_package as smoke
from scripts import prepare_sonar_coverage as coverage_paths


class PackagingBoundaryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.dist = self.root / "python/dist"
        self.dist.mkdir(parents=True)

    def wheel(self, names: list[str]) -> Path:
        target = self.dist / "example.whl"
        with zipfile.ZipFile(target, "w") as archive:
            for name in names:
                archive.writestr(name, "")
        return target

    def sdist(self, names: list[str]) -> None:
        with tarfile.open(self.dist / "example.tar.gz", "w:gz") as archive:
            for name in names:
                archive.addfile(tarfile.TarInfo(name))

    def fixture(self, language: str, content: str = "{}") -> None:
        directory = self.root / language / "tests/fixtures"
        directory.mkdir(parents=True)
        (directory / "minimal.json").write_text(content)

    def npm_input(self) -> io.TextIOWrapper:
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode="w:gz") as archive:
            for name in ["package/dist/index.js", "package/dist/index.d.ts"]:
                archive.addfile(tarfile.TarInfo(name))
        stream.seek(0)
        return io.TextIOWrapper(stream)

    def test_distribution_checks_both_languages_and_artifact_boundaries(self) -> None:
        with patch.object(distributions, "ROOT", self.root), patch.object(sys, "argv", ["check"]):
            with self.assertRaisesRegex(ValueError, "fixtures have drifted"):
                distributions.main()
            self.fixture("typescript")
            self.fixture("python", '{"drift": true}')
            with self.assertRaisesRegex(ValueError, "fixtures have drifted"):
                distributions.main()
            (self.root / "python/tests/fixtures/minimal.json").write_text("{}")
            with patch.object(sys, "stdin", self.npm_input()), self.assertRaisesRegex(ValueError, "Build Python"):
                distributions.main()
            self.sdist(["example/README.md"])
            self.wheel(["tree_spec/py.typed"])
            with patch.object(sys, "stdin", self.npm_input()), self.assertRaisesRegex(ValueError, "public import"):
                distributions.main()
            self.wheel(["tree_spec/__init__.py"])
            with patch.object(sys, "stdin", self.npm_input()), self.assertRaisesRegex(ValueError, "typing marker"):
                distributions.main()
            self.wheel(["tree_spec/__init__.py", "tree_spec/py.typed"])
            with patch.object(sys, "stdin", self.npm_input()), contextlib.redirect_stdout(io.StringIO()) as output:
                distributions.main()
            self.assertIn("1 shared wire fixtures passed", output.getvalue())
        for name in ["package/file.ts", "package/node_modules/dependency/readme"]:
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, "JavaScript implementation"):
                distributions.reject_javascript([name])

    def test_sdist_requires_metadata_and_omits_tests(self) -> None:
        with self.assertRaisesRegex(SystemExit, "no sdist"):
            smoke.verify_sdist_contents(self.dist)
        self.sdist(["example/README.md"])
        with self.assertRaisesRegex(SystemExit, "required files"):
            smoke.verify_sdist_contents(self.dist)
        required = ["example/" + name for name in ["README.md", "LICENSE", "py.typed", "VERSION"]]
        for test_path in ["example/tests/", "example/tests/test_example.py"]:
            self.sdist(required + [test_path])
            with self.subTest(test_path=test_path), self.assertRaisesRegex(SystemExit, "contains tests"):
                smoke.verify_sdist_contents(self.dist)
        self.sdist(required)
        smoke.verify_sdist_contents(self.dist)

    def test_wheel_requires_own_typed_marker(self) -> None:
        missing_marker = self.wheel(["tree_spec/__init__.py"])
        with self.assertRaisesRegex(SystemExit, "missing py.typed"):
            smoke.verify_py_typed(missing_marker)
        foreign_marker = self.wheel(["unrelated/py.typed"])
        with self.assertRaisesRegex(SystemExit, "not found under tree_spec"):
            smoke.verify_py_typed(foreign_marker)
        smoke.verify_py_typed(self.wheel(["tree_spec/py.typed"]))

    def test_smoke_stops_when_build_produces_no_wheel(self) -> None:
        self.dist.rmdir()
        with patch.object(smoke, "ROOT", self.root / "python"), patch.object(smoke, "run") as run:
            with self.assertRaisesRegex(SystemExit, "no wheel"):
                smoke.main()
            run.assert_called_once_with([sys.executable, "-m", "build"])

    def test_smoke_cleans_temporary_environment_after_install_failure(self) -> None:
        environment = self.root / "environment"
        environment.mkdir()

        def command(argv: list[str], *, cwd: Path | None = None) -> None:
            if argv[1:3] == ["-m", "build"]:
                self.dist.mkdir(exist_ok=True)
                self.wheel(["tree_spec/py.typed"])
            if "install" in argv:
                raise OSError("installation failed")

        with (
            patch.object(smoke, "ROOT", self.root / "python"),
            patch.object(smoke, "run", command),
            patch.object(smoke, "verify_sdist_contents"),
            patch.object(tempfile, "mkdtemp", return_value=str(environment)),
        ):
            with self.assertRaisesRegex(OSError, "installation failed"):
                smoke.main()
        self.assertFalse(environment.exists())
        self.assertFalse(self.dist.exists())

    def test_coverage_rejects_existing_non_source_file_and_invalid_cli(self) -> None:
        with (
            patch.object(coverage_paths, "ROOT", self.root),
            patch.object(coverage_paths, "source_hashes", return_value={}),
        ):
            target = self.root / "ignored.txt"
            target.write_text("not authored source")
            with self.assertRaisesRegex(ValueError, "Missing tooling source"):
                coverage_paths.checked_path("tooling", "ignored.txt")
        with (
            patch.object(sys, "argv", ["coverage", "invalid"]),
            self.assertRaisesRegex(ValueError, "Expected no arguments"),
        ):
            coverage_paths.main()


class AuthoringSchemaToolTests(unittest.TestCase):
    def test_unsupported_features_and_nested_schemas(self) -> None:
        from python.scripts.export_authoring_schema import check_supported

        cases: list[tuple[dict[str, object], str]] = [
            ({"anyOf": None}, "list of schemas"),
            ({"anyOf": [True]}, "alternatives require schemas"),
            ({"unexpected": True}, "Unsupported authoring schema features"),
            ({"type": "object"}, "extension policy"),
            ({"type": "array"}, "typed items"),
            ({"type": "unsupported"}, "schema type"),
            ({"type": "integer", "enum": [1]}, "string enumerations"),
            ({"$ref": "#value", "type": "string"}, "Reference refinements"),
            ({"anyOf": [], "type": "string"}, "Union refinements"),
        ]
        for schema, message in cases:
            with self.subTest(schema=schema), self.assertRaisesRegex(ValueError, message):
                check_supported(schema)
        check_supported({"properties": None, "$defs": None})
        check_supported({"type": "object", "additionalProperties": {"type": "string"}})
        check_supported({"anyOf": [{"type": "null"}, {"type": "boolean"}]})

    def test_cli_generation_check_and_drift(self) -> None:
        path = Path(__file__).resolve().parents[1] / "python/scripts/export_authoring_schema.py"
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "schema.ts"
            with patch.object(sys, "argv", [str(path), str(output)]):
                runpy.run_path(str(path), run_name="__main__")
            self.assertTrue(output.read_text().startswith("// Generated from tree_spec.authoring"))
            with patch.object(sys, "argv", [str(path), str(output), "--check"]):
                runpy.run_path(str(path), run_name="__main__")
            output.write_text("outdated")
            with (
                patch.object(sys, "argv", [str(path), str(output), "--check"]),
                self.assertRaisesRegex(SystemExit, "schema drift"),
            ):
                runpy.run_path(str(path), run_name="__main__")


class ToolingCliTests(unittest.TestCase):
    def test_distribution_cli_rejects_legacy_path(self) -> None:
        path = Path(distributions.__file__)
        with patch.object(sys, "argv", [str(path), "legacy.tgz"]):
            with self.assertRaisesRegex(ValueError, "stdin"):
                runpy.run_path(str(path), run_name="__main__")

    def test_coverage_cli_rejects_invalid_command(self) -> None:
        path = Path(coverage_paths.__file__)
        with patch.object(sys, "argv", [str(path), "invalid"]):
            with self.assertRaisesRegex(ValueError, "Expected no arguments"):
                runpy.run_path(str(path), run_name="__main__")
