# Security Policy

## Supported versions

Node.js 22.12 or newer (see `package.json` `engines`). Only the latest published release line receives security fixes.

## Reporting a vulnerability

Please report suspected security vulnerabilities **privately**. Do **not** open a public GitHub issue for security reports.

Email: security@signalsafe.software

Include a description, reproduction steps, affected versions, and impact if known. We aim to acknowledge reports within five business days.


## Security boundaries

This package validates and transforms **TreeSpec wire-format JSON**. It is contract validation and linting, not a sandbox or authorization layer.

- Parsing and lint rules enforce the documented wire contract; they do not authenticate users or authorize access to scenarios.
- Host applications must treat TreeSpec documents according to their own trust model (authoring system, admin-only sources, signed uploads, etc.).
- Host applications remain responsible for authorization, storage security, and deciding which TreeSpec content is trusted.
