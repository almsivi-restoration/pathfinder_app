---
description: "Canonical domain vocabulary, naming, casing, and formatting conventions for Game Master's Workbench. The singular voice of the codebase — ALWAYS load this instruction."
name: "gmw-lexicon"
version: "1.0.0"
applyTo: "**"
---

# Lexicon — the Singular Voice

This file pins the domain vocabulary and conventions every agent and
contributor must use. Terms here are canonical: use them in code,
identifiers, comments, docs, and conversation about this repo. If a term
needs to change, change it here in the same commit as the code.

## First principle: the ruleset boundary

**Ruleset-neutral core, ruleset-selected configuration.** Domain entities
(Actor, Scene, Campaign) carry no edition-specific fields or logic. The
selected campaign ruleset supplies sheet definitions, validation,
calculations, and behavior through registered configuration
(`RULESET_CONFIG_*` in `backend/rules/`). The Campaign alone persists the
ruleset; encounters and actors inherit it. Never scatter edition checks
(`if ruleset == "1e"`) through the core — the ruleset config is the
controlling behavior boundary.

## Canonical domain nouns

| Term | Meaning | Notes |
|---|---|---|
| **Campaign** | Top-level container. Owns the ruleset, scene list, actor templates, notes. | Only entity that persists a ruleset. |
| **Scene** | An encounter workspace: actors, initiative order, round/turn state. | Belongs to a Campaign. |
| **Actor** | A creature/character in a Scene. Ruleset-neutral identity (name, player_name, is_pc, color), encounter state (initiative_roll, effects, notes), and arbitrary `sheet` data. | Templates are Actors stored on the Campaign. |
| **Sheet Definition** | The ruleset-supplied schema: fields, summary, player_resource metadata. Served by `GET /api/rules/current`. | Declarative; built in `backend/rules/common.py`. |
| **Sheet Data** | An Actor's `sheet` dict — values at dotted paths (`hp.current`, `defenses.ac`). | Read/write via `get_sheet_value`/`set_sheet_value` helpers. |
| **Actor Template** | A pre-built Actor stored on the Campaign, instantiated into Scenes. | Carries color and full sheet; instantiate copies wholesale. |
| **Initiative** | Turn order within a Scene: `initiative_order` (actor IDs), `current_round`, `current_turn_index`. | Rolls are GM-entered physical-die values + bonus. |
| **Effect** | A timed condition on an Actor (`name`, `duration_rounds`, `description`). | |
| **Ruleset** | A game edition registered in `backend/rules/__init__.py` (`RULESETS` dict). | Currently `1e`, `2e`. |
| **Bestiary Entry** | A monster record in the per-ruleset bestiary sqlite index, imported from the user-supplied `bestiary.csv`. | Mapped to Actors via the ruleset's `bestiary_mapper`. |
| **Reference Library** | Per-ruleset collection of user-supplied reference PDFs, indexed for search. | Routes under `/api/references/current/*`. |
| **Source Manifest** | JSON manifest describing a ruleset's reference sources. | `manifests/<ruleset>.json`. |

## Shared sheet contract keys

Every ruleset's sheet (character or monster) MUST expose these dotted
paths — the tracker, actor rows, and player view read them directly:

- `hp.current`, `hp.max`
- `defenses.ac`
- `initiative.bonus`

A ruleset may add any additional structure, but these keys are the
cross-ruleset contract and are not negotiable within a sheet definition.

## Naming and casing

- **Python:** snake_case modules, functions, variables; PascalCase classes
  (Pydantic models). 4-space indent. No trailing whitespace.
- **API routes:** `/api/<domain>/<verb-or-resource>` — e.g.
  `/api/scene/load`, `/api/actor/{actor_id}`, `/api/rules/current`.
  Domains: `campaign`, `scene`, `actor`, `initiative`, `references`,
  `bestiary`, `rules`, `names`. Plural only for list endpoints
  (`/api/scenes`, `/api/rulesets`).
- **React:** PascalCase components, one component per file, file named
  after the component (`ActorRow.jsx`). camelCase functions, variables,
  and zustand store keys. 2-space indent in JSX/JS.
- **CSS:** one file per component in `frontend/src/styles/`, named after
  the component (`ActorRow.css`). Theme tokens use the `--mw-` prefix and
  are defined only in `theme.css` — components reference tokens, never
  hardcode palette colors.
- **State:** all server state flows through the zustand store
  (`frontend/src/store.js`); components never call axios directly.

## Pinned conventions (learned, do not re-learn)

- **Button classes:** `.btn` and `.btn-small` are self-contained.
  Variant classes (e.g. `.btn-edit`) only override accent color — never
  redefine background. Verify the base class is actually in the JSX.
- **Grid/flex inputs:** set `min-width: 0` and
  `width: 100%; box-sizing: border-box` on inputs inside grid/flex
  fields, or the column overflows and clips.
- **Color inputs:** bare `<input type="color">` ignores CSS sizing in
  Chromium — use the ColorSwatch proxy pattern (fixed-size button +
  visually hidden input).
- **Fonts:** Linux Libertine O / Display O, bundled under OFL; family
  names match the system package so dev and packaged rendering agree.
- **Theme:** gold is accent-only, never a surface or frame color.
  `color-scheme: dark` in `:root` is load-bearing for native controls.

## Deviation

These are defaults, not gates. A justified deviation is recorded by
updating this file in the same commit as the work — the lexicon and the
code never disagree across a commit boundary. If the lexicon must be
mangled to describe the work, the lexicon entry was wrong: fix the
lexicon, not the work.
