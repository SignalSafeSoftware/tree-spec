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

## CI tooling and npm auth

- Local development and CI use **Yarn** for `install`, `test`, `build`, and `smoke:package`.
- CI **publish** uses **`npm publish`** (non-interactive; compatible with 2FA-enabled npm accounts when auth is configured correctly).
- Set the GitHub Actions secret **`NPM_TOKEN`** to a publish-capable npm token unless **npm trusted publishing/OIDC** is configured for the repository.
- If the npm account or package requires **2FA for publish**, the token must support non-interactive publishing — for example a granular access token with read/write package access and **2FA bypass enabled for write actions**, or npm trusted publishing/OIDC.
- CI writes auth to `~/.npmrc` only; no `.npmrc` is committed to the repository.
- CI does not run `npm version` or bump versions during publish; the committed `package.json` version is published as-is.

## Before you release

1. Bump `version` in `package.json`.
2. Update [CHANGELOG.md](./CHANGELOG.md) (`[Unreleased]` → new version section when tagging).
3. Run locally:

   ```bash
   yarn install --frozen-lockfile
   yarn typecheck
   yarn test
   yarn build
   npm publish --dry-run
   ```

4. Run artifact smoke test: `yarn smoke:package` (pack, temp consumer install, export/type checks — enforced in CI before publish).

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

CI runs `yarn smoke:package`, logs the package version, then publishes with `npm publish` using `NPM_TOKEN` auth.
