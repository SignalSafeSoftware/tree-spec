"""TreeSpec wire-format constants (aligned with TypeScript `packages/tree-spec`)."""

from __future__ import annotations

# Canonical id for the terminal node in the wire format.
END_NODE_ID = "END"

# Legacy alias seen in older payloads; may be normalized on read in consumers.
LEGACY_END_NODE_ID = "__END__"

# Bump when the JSON shape changes (interoperability with TS `TREESPEC_WIRE_VERSION`).
TREESPEC_WIRE_VERSION = 1
