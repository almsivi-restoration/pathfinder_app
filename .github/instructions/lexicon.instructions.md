---
description: "Canonical domain vocabulary, naming, casing, and formatting conventions for Game Master's Workbench. The singular voice of the codebase — ALWAYS load this instruction."
name: "gmw-lexicon"
version: "1.3.0"
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
| **Campaign** | Top-level container. Owns the ruleset, scene list, actor templates, notes, venues. | Only entity that persists a ruleset. |
| **Scene** | An encounter workspace: actors, initiative order, round/turn state. | Belongs to a Campaign. |
| **Actor** | A creature/character in a Scene. Ruleset-neutral identity (name, player_name, is_pc, color, symbol), encounter state (initiative_roll, effects, notes), and arbitrary `sheet` data. | Templates are Actors stored on the Campaign. |
| **Marker Symbol** | A simple, hand-drawable mark (`dot`, `cross`, `star`, …) identifying an Actor's physical base, chosen beside its color. | Catalog in `frontend/src/markerSymbols.js`; `Actor.symbol` stores the id, optional. Always drawn on its base disc (`MARKER_BASES`), which is content, not a theme surface. |
| **Sheet Definition** | The ruleset-supplied schema: fields, summary, player_resource metadata. Served by `GET /api/rules/current`. | Declarative; built in `backend/rules/common.py`. |
| **Sheet Data** | An Actor's `sheet` dict — values at dotted paths (`hp.current`, `defenses.ac`). | Read/write via `get_sheet_value`/`set_sheet_value` helpers. |
| **Actor Template** | A pre-built Actor stored on the Campaign, instantiated into Scenes. | Carries color, symbol, and full sheet; instantiate copies wholesale. |
| **Initiative** | Turn order within a Scene: `initiative_order` (actor IDs), `current_round`, `current_turn_index`. | Rolls are GM-entered physical-die values + bonus. |
| **Effect** | A timed condition on an Actor (`name`, `duration_rounds`, `description`). | |
| **Ruleset** | A game edition registered in `backend/rules/__init__.py` (`RULESETS` dict). | Currently `1e`, `2e`, `numenera`. |
| **Bestiary Entry** | A monster record in the per-ruleset bestiary sqlite index, imported from the user-supplied `bestiary.csv`. | Mapped to Actors via the ruleset's `bestiary_mapper`. |
| **Reference Library** | Per-ruleset collection of user-supplied reference PDFs, indexed for search. | Routes under `/api/references/current/*`. |
| **Source Manifest** | JSON manifest describing a ruleset's reference sources. | `manifests/<ruleset>.json`. |
| **Campaign Export** | A single portable JSON bundle (`format: "gm-workbench-campaign"`, integer `version`) holding a saved Campaign, its saved Scenes, and its Venues. | `GET /api/campaign/export`, `POST /api/campaign/import`; import never overwrites — a taken name gets an ` (imported)` suffix. Version 2 added venues; version 1 bundles still import. |
| **Venue** | A square-grid map belonging to a Campaign: terrain cells, wall/door edges, and stamped features. Not "map" or "location". | One file per venue at `campaigns/<name>/venues/<venue_id>.json`; catalog in `frontend/src/venueCatalog.jsx`. Notes, `gm_only` features, and secret doors never reach players. |
| **Venue Screen** | The pop-out second-monitor window showing players the shown Venue. | Reads only `GET /api/venue/shown` (the player-filtered copy); which venue is shown is in-memory session state. |
| **Mat Guide** | A step-by-step drawing guide for copying a Venue onto the physical one-inch grid mat, in the four marker colors. | Default mat 34×48; splits venues larger than the mat into sections. |
| **Local Theme** | A user-installed UI skin: a folder under the themes directory with a `theme.json` manifest and a `theme.css` stylesheet overriding `--mw-*` tokens. | Built-in `morrowind` theme always available (the base sheet); `dissidia` and `pokemon` ship as vendored built-ins layered on it; selection persists via `theme-settings.json`. |

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
  `bestiary`, `rules`, `names`, `venue`. Plural only for list endpoints
  (`/api/scenes`, `/api/rulesets`, `/api/venues`).
- **React:** PascalCase components, one component per file, file named
  after the component (`ActorRow.jsx`). camelCase functions, variables,
  and zustand store keys. 2-space indent in JSX/JS.
- **CSS:** one file per component in `frontend/src/styles/`, named after
  the component (`ActorRow.css`). Theme tokens use the `--mw-` prefix and
  are defined only in `theme.css` — components reference tokens, never
  hardcode palette colors. Exception: map art (venue terrain, inks, mat
  marker colors) and the marker-symbol bases are content and live as
  constants in `venueCatalog.jsx` and `markerSymbols.js`, so a venue or a
  marker looks the same under every theme and on the mat.
- **State:** all server state flows through the zustand store
  (`frontend/src/store.js`); components never call axios directly.

## Pinned conventions (learned, do not re-learn)

- **Button classes:** `.btn` and `.btn-small` are self-contained.
  Variant classes (e.g. `.btn-edit`) only override accent color — never
  redefine background. Verify the base class is actually in the JSX.
  Toolbar and segmented buttons compose on `.btn` too, so every skin's
  button restyle reaches them.
- **Glyph icons:** draw toolbar and button glyphs (zoom −/+, rotate, and
  the like) as inline SVG stroked with `currentColor`. Theme display faces
  (the Pokémon pixel font) lack symbols such as U+2212 and render them as
  a hairline.
- **Cues on content:** a theme-colored highlight drawn on content that
  does not change with the theme (the venue map's paper) rides on a casing
  in the content's own ink; the accent alone washes out under a pale
  theme.
- **Print rules outrank skins:** a component's `@media print` rules are
  scoped (`body.mat-guide-open …`) so the base theme sheet and the skins,
  which load later, cannot restyle the printed page.
- **Grid/flex inputs:** set `min-width: 0` and
  `width: 100%; box-sizing: border-box` on inputs inside grid/flex
  fields, or the column overflows and clips.
- **Header/row column alignment:** in a flex table with a separate header
  row, a column whose row content is wider than its flex share (e.g. a
  button cluster) will not shrink below content width, so the row's columns
  drift from the header's. Give that column the same fixed
  `flex: 0 0 <width>` in both the header and row CSS (keep the two values
  in sync), and `min-width: 0` on the flexible columns.
- **Nowrap is not containment:** `white-space: nowrap` on a flex item stops
  wrapping but not overflow — the one line keeps painting over its following
  siblings. Contain it with `min-width: 0` + `overflow: hidden` +
  `text-overflow: ellipsis` on the text column, and `flex-shrink: 0` on the
  trailing action cluster so the buttons are never the shrink casualty.
- **Color inputs:** bare `<input type="color">` ignores CSS sizing in
  Chromium — use the ColorSwatch proxy pattern (fixed-size button +
  visually hidden input).
- **Fonts:** Linux Libertine O / Display O, bundled under OFL; family
  names match the system package so dev and packaged rendering agree.
- **Current turn:** the actor whose turn it is carries the class
  `current-turn` and `aria-current="true"` on every screen, styled only
  from the `--mw-turn-accent` / `--mw-turn-tint` / `--mw-turn-glow`
  tokens (derived from the theme accent in `theme.css`). Always pair the
  color with a non-color cue (label or marker), never shift layout, and
  keep motion one-shot (`mw-turn-arrive`, disabled under
  `prefers-reduced-motion`). Resolve the current actor by ID from
  `initiativeOrder[currentTurnIndex]`, never by index into a local list.
- **Theme:** gold is accent-only, never a surface or frame color.
  `color-scheme: dark` in `:root` is load-bearing for native controls.

## Deviation

These are defaults, not gates. A justified deviation is recorded by
updating this file in the same commit as the work — the lexicon and the
code never disagree across a commit boundary. If the lexicon must be
mangled to describe the work, the lexicon entry was wrong: fix the
lexicon, not the work.
