# Security Policy

## Supported versions

Python 3.12 and 3.13 (see `pyproject.toml` `requires-python`). Only the latest published release line receives security fixes.

## Reporting a vulnerability

Please report suspected security vulnerabilities **privately**. Do **not** open a public GitHub issue for security reports.

Email: security@signalsafe.software

Include a description, reproduction steps, affected versions, and impact if known. We aim to acknowledge reports within five business days.


## Security boundaries

This package validates and transforms **TreeSpec wire-format JSON** in Python. It mirrors the TypeScript contract; it is not a sandbox or authorization layer.

- Pydantic models and lint helpers enforce the documented wire contract; they do not authenticate users or authorize access to scenarios.
- Host applications must decide which TreeSpec documents are trusted and protect storage and publish paths accordingly.
- Host applications remain responsible for authorization and content trust, consistent with the TypeScript `@signalsafe/tree-spec` package.
