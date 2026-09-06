# Game Master's Workbench — Agent Instructions

Rules for AI agents working in this repository. Read this before making changes
or cutting a release.

## Project shape

- `backend/` — FastAPI (Python 3.12). Run/tests via the project venv:
  `backend/venv/bin/python -m pytest` and `backend/venv/bin/python main.py`.
  System `python3` does NOT have uvicorn; always use `backend/venv/bin/python`.
- `frontend/` — Create React App + Electron. `public/electron.js` is the main
  process; `public/preload.js` is the preload bridge.
- Data lives under the per-user data dir in the packaged app
  (`~/.config/Game Masters Workbench/data/`); repo-relative in dev.

## Hard rules

- **Never commit reference PDFs or copyrighted game content.** The reference
  library is user-supplied at runtime; nothing under `artifacts/local/` or any
  rulebook content is committed or shipped.
- **productName must never contain an apostrophe.** electron-builder embeds it
  in single-quoted shell in the deb maintainer scripts; an apostrophe breaks
  `postinst` with "syntax error: unexpected end of file" and bricks the deb.
  Current value: `Game Masters Workbench`.
- **Keep `frontend/public/electron.js` and `frontend/public/preload.js` synced
  to `frontend/build/` after editing them** — the react-cra preset points the
  packaged main entry at `build/electron.js`, and the build does NOT copy it
  for you. Copy both files after any edit: `cp public/electron.js
  public/preload.js build/`.
- **`electron-is-dev` and other devDependencies are not shipped.** Require them
  lazily (try/catch) in `electron.js` so the packaged main process cannot crash
  on a missing dev-only module.
- **CSS grid/flex fields:** grid items default to `min-width: auto` and will not
  shrink below their content. When adding inputs to a grid/flex field, set
  `min-width: 0` and `width: 100%; box-sizing: border-box` on the input or the
  column will overflow and clip the leftmost field.
- **Branch check before every commit:** run `git branch --show-current` and
  confirm you are on `main` (or the intended branch) before `git commit`.

## Release process

Follow this exact sequence. Do not skip the verification gates.

### 1. Choose the version

- Inspect the latest tag: `git tag -l | sort -V | tail -1` (do NOT infer from a
  changelog or memory). Read every commit since that tag:
  `git log --oneline <latest>..HEAD`.
- Pick `vX.Y.Z`: **major** = breaking/incompatible, **minor** =
  backward-compatible feature, **patch** = fix/docs/internal. Use the highest
  applicable increment when a release mixes kinds.
- Bump `frontend/package.json` `"version"` to match the tag exactly. This drives
  the artifact names, the About dialog, and the auto-updater's version check.

### 2. Verification gates (all must pass)

```bash
cd backend && venv/bin/python -m pytest -q            # backend tests
cd ../frontend && CI=true npm run react-test -- --watchAll=false   # frontend tests
```

### 3. Build

```bash
cd backend && venv/bin/pyinstaller --noconfirm gm-workbench-backend.spec
cd ../frontend && cp public/electron.js public/preload.js build/
cd frontend && rm -rf dist && npm run build
```

This produces `frontend/dist/Game-Masters-Workbench-<ver>-linux-x86_64.AppImage`,
`...-linux-amd64.deb`, and `latest-linux.yml`.

### 4. Verify the artifacts before publishing

- **deb maintainer scripts must parse.** This is the check that would have
  caught the v0.4.0 apostrophe bug:
  ```bash
  cd /tmp && rm -rf gmw_debcheck && mkdir gmw_debcheck && cd gmw_debcheck && \
    dpkg-deb -e <path-to>.deb && bash -n DEBIAN/postinst && bash -n DEBIAN/postrm
  ```
- **deb package identity must stay `gm-workbench`** (`dpkg-deb -I <deb> | grep
  Package:`) or apt will treat it as a different package and not upgrade.
- **`latest-linux.yml` url must match the AppImage asset name.** Artifact names
  are space-free (`artifactName` in package.json) precisely because GitHub
  renames spaced assets to dots while the updater metadata keeps hyphens —
  confirm the `url:` entry equals the AppImage filename you will upload.

### 5. Commit, tag, push

```bash
git branch --show-current          # must say main
git add <only the files for this change>
git commit -m "<what changed>\n\nRelease vX.Y.Z."
git tag -a vX.Y.Z -m "Release vX.Y.Z: <summary>"
git push origin main && git push origin vX.Y.Z
git ls-remote --tags origin vX.Y.Z # confirm the ref moved
```

### 6. Create the GitHub release with all three assets

`latest-linux.yml` is REQUIRED as an asset or auto-update silently breaks.

```bash
gh release create vX.Y.Z \
  "frontend/dist/Game-Masters-Workbench-X.Y.Z-linux-x86_64.AppImage" \
  "frontend/dist/Game-Masters-Workbench-X.Y.Z-linux-amd64.deb" \
  "frontend/dist/latest-linux.yml" \
  --title "vX.Y.Z — <short title>" --notes "<notes>"
```

Notes must include: what changed, a **Data compatibility** statement (updates
replace only the app image; user data under `~/.config/Game Masters
Workbench/data/` is preserved — if a release ever breaks that, state it plainly
and mark it incompatible), and a verification summary.

### Release notes format (follow it exactly)

- **Title:** `vX.Y.Z — <short imperative title>` (em dash, not just the tag).
- **Body** uses Markdown sections, in this order, omitting any that don't apply:
  - `## New` — features added.
  - `## Changed` — behavior or naming changes.
  - `## Fixed` — bug fixes, each with a one-line cause.
  - `## Data compatibility` — always present. State whether prior data is
    preserved/compatible, or plainly mark the release incompatible if not.
  - `## Verification` — always present. Test counts, artifact checks
    (deb scripts, package identity, updater metadata), and what was exercised.
- **Pass real newlines, not literal `\n`.** Write `--notes` with actual line
  breaks (the shell heredoc/`$'...'` form), never an escaped `\n` sequence —
  that is what made v0.6.0 render as one run-on line. Preview with
  `gh release view <tag> --json body` after creating.

## Auto-update

electron-updater runs in the packaged main process, gated to AppImage
(`process.env.APPIMAGE`) and Windows NSIS. The deb is apt-managed and never
self-updates. Updates replace only the application image; user data is always
preserved unless a release is explicitly marked incompatible.
