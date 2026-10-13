# Python releases from the combined TreeSpec repository

The maintained source is `tree-spec/python`. Read [the repository release guide](../RELEASING.md).
Build Python from this directory. Publish only its wheel/sdist with a `py-v<version>` tag;
the root npm release uses `ts-v<version>` independently. Manual dispatch defaults to checks only.

PyPI trusted publishing must be configured for repository `SignalSafeSoftware/tree-spec`,
workflow `python.yml`, and environment `pypi`. The previous standalone repository's trusted
publisher does not grant this new workflow access. No publication has been performed.
