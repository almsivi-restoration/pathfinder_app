---
description: "Blueprint index and maintenance mechanism for Game Master's Workbench — the catalog of architectural patterns, when to consult them, and how to add or revise them. ALWAYS load this instruction."
name: "gmw-blueprint-index"
version: "1.0.0"
applyTo: "**"
---

# Blueprint Index and Maintenance

Blueprints are the codified recurring shapes of this architecture —
modular building blocks, not straitjackets. Each lives in
`.github/blueprints/` with its own `applyTo` scoping so it loads when an
agent touches matching files. This index is the always-loaded catalog:
know what exists before designing around a problem a blueprint already
solves.

## Catalog

| Blueprint | File | Scope | Governs |
|---|---|---|---|
| Backend route module | [backend-route-module.md](../blueprints/backend-route-module.md) | `backend/**/*.py` | FastAPI routes: grouping, errors, `model_dump`, StateManager access |
| Ruleset module | [ruleset-module.md](../blueprints/ruleset-module.md) | `backend/rules/**` | `RULESET_CONFIG` contract, registration, sheet builders, bestiary mapper |
| React component pair | [react-component-pair.md](../blueprints/react-component-pair.md) | `frontend/src/**` | Component + CSS pairing, store access, theme tokens, IPC dialogs |
| State mutation flow | [state-mutation-flow.md](../blueprints/state-mutation-flow.md) | `**` | The single path from UI action to persisted JSON |
| Test conventions | [test-conventions.md](../blueprints/test-conventions.md) | tests | Synthetic fixtures only, backend isolation, jsdom/zustand seeding |

The lexicon ([lexicon.instructions.md](lexicon.instructions.md)) is the
companion piece: canonical vocabulary, naming, casing, and pinned
conventions. Blueprints reference it; they don't repeat it.

## The fitness test

Blueprints state defaults, not gates. **If applying a blueprint requires
mangling the work, the blueprint was wrong for that space.** The correct
moves, in order:

1. Deviate locally, with a comment naming the blueprint and why it
   didn't fit.
2. In the **same commit**, either narrow the blueprint's stated scope or
   revise the blueprint so the work fits it honestly.

The one disallowed outcome is forcing the fit — code twisted to match a
blueprint that doesn't describe it. A blueprint that can't accommodate
legitimate improvement is a bug in the blueprint.

## Adding a blueprint

Trigger: a shape repeats a second time, or a new subsystem is introduced.

1. Create `.github/blueprints/<name>.md` with frontmatter:
   `description`, `name` (`bp-<name>`), `version: "1.0.0"`, and an
   `applyTo` glob matching the files the blueprint governs.
2. Body structure: **Purpose** → **Holotype** (a real, minimal exemplar
   lifted from the codebase — never an invented ideal) → **Contract**
   (what must be true, as checkable bullets) → **When this doesn't fit**.
3. Add one row to the catalog table above.
4. Bump this file's `version`.

## Revising a blueprint

- A justified deviation is recorded as a blueprint revision in the same
  commit as the work — blueprint and code never disagree across a commit
  boundary.
- Bump the blueprint's `version` and state what changed at the bottom of
  the file if the revision changes prior guidance.
- Removing a blueprint: delete the file and its catalog row together.

## Review cadence

The release runbook's documentation pass includes one question:
"do the lexicon and blueprints still match the code being released?" If
nothing changed, that's a valid outcome — but check, don't skip.
