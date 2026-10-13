# Python releases from the combined TreeSpec repository

The maintained source is `tree-spec/python`. Read [the repository release guide](../RELEASING.md).
Build Python from this directory. Publish only its wheel/sdist with a `py-v<version>` tag;
the `typescript/` npm release uses `ts-v<version>` independently.

`ci.yml` calls `python.yml` and `typescript.yml` in parallel. Manual CI dispatch
on `main` defaults to checks only; enable `publish_pypi` for Python.
Python publishes only after its own required checks pass.

Configure a package-scoped `PYPI_API_TOKEN` repository or `pypi` environment secret.
PyPI does not support trusted publishing from reusable workflows; this workflow
therefore uses token authentication and disables trusted-publisher attestations.
See [PyPI documentation](https://docs.pypi.org/trusted-publishers/troubleshooting/).
No credential was created and no publication has been performed.
