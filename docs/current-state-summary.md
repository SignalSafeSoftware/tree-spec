# Current TreeSpec source — 2026-10-21

The reviewed combined baseline is `c6d8ba28223661ba507692cd3f688c27cd638e12`. This source prepares TypeScript and Python **0.4.4**. Existing public baselines are npm 0.4.2 and Python 0.4.3. Candidate metadata is not a publication claim.

The maintained namespaces are `@signalsafe/tree-spec` and `tree_spec`. The separate legacy `tree-spec-python` repository and `deliveryplus_tree_spec` namespace are retired; do not use them as an alternate publisher or replace the maintained authoring implementation with them.

DeliveryPlus currently uses Step 5 archives with local version labels. The candidate is checked against their actual bytes: all authored fixture files and public TypeScript declarations agree; Python authoring modules are byte-identical, and the private lint argument removal preserves behavior. Differential checks cover parse, authoring validation and lint outcomes, ordered errors, opaque JSON, cycles and sparse collections. Release metadata never authorizes a host downgrade.

One root workflow runs both language suites, verifies report provenance and runs one combined Sonar analysis under `SignalSafeSoftware_tree-spec-ts`. Both registry publishers wait for both language suites and the combined gate. All original tag/manual publishing interfaces remain; see [RELEASING.md](../RELEASING.md). Do not create tags, publish or adopt in hosts before approval and exact artifact verification.

Build constraints use setuptools `>=84.2.1,<85`, wheel `>=0.46,<1` and development build `>=1.6.1,<2`. These are build tools, not runtime API changes. Runtime parse/authoring/lint behavior and shared wire fixtures remain authoritative. Full runtime coverage thresholds remain 100%; combined overall coverage includes tooling and is reported separately.
