"""Packed distribution checks never open a caller-controlled filesystem path."""
from __future__ import annotations

import io
import tarfile
import unittest
from unittest.mock import patch

from python.scripts.check_distributions import check_npm_archive, main


def archive_bytes(names: list[str]) -> io.BytesIO:
    stream = io.BytesIO()
    with tarfile.open(fileobj=stream, mode="w:gz") as archive:
        for name in names:
            archive.addfile(tarfile.TarInfo(name))
    stream.seek(0)
    return stream


class DistributionStreamTest(unittest.TestCase):
    def test_public_entries_are_required(self) -> None:
        stream = archive_bytes(["package/dist/index.js", "package/dist/index.d.ts"])
        check_npm_archive(stream)
        incomplete = archive_bytes(["package/dist/index.js"])
        with self.assertRaisesRegex(ValueError, "public JavaScript/types"):
            check_npm_archive(incomplete)

    def test_foreign_language_members_are_rejected_without_extraction(self) -> None:
        names = ["package/dist/index.js", "package/dist/index.d.ts", "../../outside.py"]
        stream = archive_bytes(names)
        with self.assertRaisesRegex(ValueError, "Python implementation"):
            check_npm_archive(stream)

    def test_invalid_archive_bytes_fail_closed(self) -> None:
        stream = io.BytesIO(b"not a compressed archive")
        with self.assertRaises(tarfile.ReadError):
            check_npm_archive(stream)

    def test_legacy_filesystem_argument_is_rejected_before_reading_stdin(self) -> None:
        with patch("sys.argv", ["check_distributions.py", "/outside.tgz"]), self.assertRaisesRegex(ValueError, "stdin"):
            main()


if __name__ == "__main__":
    unittest.main()
