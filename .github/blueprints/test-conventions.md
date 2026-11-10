---
description: "Blueprint: testing conventions for Game Master's Workbench — synthetic fixtures only, backend isolation via tmp_path, and the jsdom/zustand seeding pattern. Load when writing or editing tests."
name: "bp-test-conventions"
version: "1.1.0"
applyTo: "backend/tests/**, frontend/src/**/*.test.*"
---

# Blueprint: Test Conventions

## Purpose

Tests verify behavior without ever touching real user data or real game
content. Both tiers isolate state explicitly rather than relying on
cleanup luck.

## Hard rule: synthetic content only

**Never commit reference PDFs, bestiary CSVs, or other user-supplied game
content.** Tests that need a bestiary or reference source use a small
synthetic fixture written for the test (see the bestiary fixture CSV
pattern). Nothing under `artifacts/local/` is committed or shipped.

## Backend (pytest)

Holotype: [conftest.py](../../backend/tests/conftest.py).

- **Run via the project venv:** `backend/venv/bin/python -m pytest`.
  System python3 lacks the deps.
- **`backend/` is a flat module set** (no package `__init__.py`);
  `conftest.py` inserts it into `sys.path`. Tests import `main`,
  `state`, `models` directly.
- **Isolation via `tmp_path`:** the `state_manager` fixture builds a
  `StateManager` on a temp dir; the `client` fixture reassigns
  `main.state_manager` so every request through the `TestClient` uses
  the isolated instance. Never let a test touch `backend/campaigns/`.
- New route tests go through the `client` fixture; new StateManager
  logic tests use `state_manager` directly.

## Frontend (Jest + Testing Library)

- **Run:** `CI=true npm run react-test -- --watchAll=false`.
- **Zustand in jsdom:** seed the store state directly and stub async
  fetchers. The real `fetchRulesetConfig` swallows axios returns, so
  async config never lands in jsdom tests — set `rulesetConfig` and
  replace the fetch action in the store state instead (precedent:
  ActorViewModal/ActorTemplateLibrary tests).
- Test files live next to the component: `Component.test.jsx`.
- **Electron main process:** test `public/electron.js` under
  `@jest-environment node` by loading it with a fake `electron` module
  (fake `BrowserWindow`, `ipcMain`, `app`, `Menu`) and driving its IPC
  handlers and menu items directly. Never run the `ready` handler in a
  packaged-mode test — it spawns the backend. Holotype:
  [electronVenueWindow.test.js](../../frontend/src/electronVenueWindow.test.js).
- **Stylesheet contracts:** jsdom applies no CSS, so a rule about which
  selectors a sheet must own is tested structurally — read the `.css`
  files under `@jest-environment node` and assert on their selectors.
  Keep a deliberately broken input beside the check so its failing branch
  stays exercised. Holotype:
  [themeSelectorContract.test.js](../../frontend/src/themeSelectorContract.test.js).

## When this doesn't fit

An integration test that genuinely needs a realistic corpus (performance
characterization, parser fuzzing) generates that corpus programmatically
at test time — it still never commits real game content.
