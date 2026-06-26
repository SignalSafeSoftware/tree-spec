# Releasing `@signalsafe/tree-spec`

Standalone repository: [SignalSafeSoftware/tree-spec](https://github.com/SignalSafeSoftware/tree-spec).

## CI publish policy

- **Checks and tests** run on every pull request.
- **`scan` (Sonar)** on pull requests is **optional** — it runs only when the PR has the **`scan`** label. On **`push`** (including **`v*`** tag pushes) and **`workflow_dispatch`**, **`scan`** runs automatically.
- **Publish does not run** from PR labels.
- **Publish runs** when:
  - **Manual:** GitHub Actions → **CI** → **Run workflow** on branch **`main`**, or
  - **Tag:** push a semver tag matching `v*` (for example `vX.Y.Z`).
- **Publish requires** successful **`checks`**, **`tests`**, and **`scan`** jobs in the same workflow run (see [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).
- Pushing a **`v*`** tag starts a workflow run where **`checks`**, **`tests`**, and **`scan`** run before **Publish** can proceed.
- **GitHub Releases do not trigger publish** in the current workflow.
- **No npm Environment approval or provenance** in CI today.

## Before you release

1. Bump `version` in `package.json`.
2. Update [CHANGELOG.md](./CHANGELOG.md) (`[Unreleased]` → new version section when tagging).
3. Run locally:

   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run build
   npm publish --dry-run
   ```

4. **Future required gate (not yet in CI):** install the packed tarball in a temporary consumer and smoke-test documented exports (Batch 6).

## Publish

1. Commit the version and changelog updates on **`main`**:

   ```bash
   git add package.json CHANGELOG.md
   git commit -m "Release vX.Y.Z"
   git push origin main
   ```

2. Tag and push (recommended — triggers **Publish** when required jobs succeed):

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

   **Option B — Manual dispatch:** merge release commits to **`main`**, then GitHub → **Actions** → **CI** → **Run workflow** (branch **`main`**). Ensure `package.json` `version` matches the release you intend to ship.

## After publish

```bash
npm view @signalsafe/tree-spec version
```

Post-publish consumer smoke tests are planned but not yet required in CI (Batch 6).
