# Current TreeSpec source — 2026-11-15

The published TypeScript and Python baseline is **0.4.4**. This source prepares compatible **0.4.5** maintenance releases with reviewed Vitest/Vite, Ruff and Pydantic lock updates. The existing parsing, opt-in strict authoring validation, graph diagnostics, ordered issues and opaque JSON extension behavior remain unchanged. Candidate metadata is not a registry publication or host adoption claim.

The maintained namespaces are `@signalsafe/tree-spec` and `tree_spec`. The separate `tree-spec-python` repository and former product-specific Python namespace are retired; neither is an alternate publisher. Application-owned simulator, lesson and adventure state remains outside this package.

Packed TypeScript smoke checks now exercise the existing public `validateAuthoringDocument` export alongside parser, lint and compiler exports. The actual TypeScript and Python examples, paired fixtures, strict types and runtime coverage gates remain part of release validation.

One root workflow runs both language suites, verifies coverage provenance and waits for one combined Sonar quality gate. Both registry publishers require both language suites and that gate. Independent immutable `ts-v*` and `py-v*` tags select their corresponding distribution; see [release instructions](../RELEASING.md). Host adoption follows verified registry artifacts and normal lockfile updates.

Original uncommitted ecosystem work was backed up before reconciliation. Current upstream refactors, additional negative tests, normal dependency resolution and stronger combined release gates were preserved. No compatibility alias, new domain dependency or wire-format change is introduced by this maintenance release.
