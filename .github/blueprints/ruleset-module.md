---
description: "Blueprint: how a ruleset module is shaped — the RULESET_CONFIG contract, registration, sheet builders, and bestiary mapper ownership. Load when adding or editing a ruleset."
name: "bp-ruleset-module"
version: "1.0.0"
applyTo: "backend/rules/**"
---

# Blueprint: Ruleset Module

## Purpose

A ruleset is a self-contained configuration module in `backend/rules/`
that supplies everything edition-specific: sheet definitions, ability
math, skill/save lists, races, and the bestiary mapper. The core never
imports a ruleset directly — it looks rulesets up through the central
registry.

## Holotype

[ruleset_1e.py](../../backend/rules/ruleset_1e.py) is the canonical
shape: constants for the edition's lists, then a single
`RULESET_CONFIG_*` dict:

```python
RULESET_CONFIG_1E = {
    "name": "Pathfinder 1e",
    "reference_directory": "pathfinder_1e",
    "races": RACES_1E,
    "abilities": ABILITIES,
    "skills": SKILLS_1E,
    "saves": SAVES_1E,
    "max_level": 20,
    "ability_modifier_calc": lambda ability_score: (ability_score - 10) // 2,
    "actor_sheet": build_pathfinder_1e_actor_sheet(SKILLS_1E, SAVES_1E),
    "monster_sheet": build_pathfinder_1e_monster_sheet(),
    "bestiary_mapper": map_bestiary_entry_to_actor,
}
```

## Contract

- **One module per ruleset:** `ruleset_<id>.py`, exporting exactly one
  `RULESET_CONFIG_<ID>` dict.
- **Registration is central and explicit:** import the config in
  [rules/__init__.py](../../backend/rules/__init__.py) and add it to the
  `RULESETS` dict under its short id (`"1e"`, `"2e"`). Nothing else
  registers rulesets.
- **Required keys:** `name`, `reference_directory`, `races`,
  `abilities`, `skills`, `saves`, `max_level`, `ability_modifier_calc`,
  `actor_sheet`. Optional: `monster_sheet`, `bestiary_mapper` (a ruleset
  without bestiary support simply omits them).
- **Sheet builders live in `rules/common.py`** as shared declarative
  machinery; the ruleset module calls them with its own lists. Edition
  logic belongs in the ruleset module or `common.py` — never in `main.py`
  or `state.py`.
- **Every sheet definition exposes the shared contract keys** from the
  lexicon: `hp.current`, `hp.max`, `defenses.ac`, `initiative.bonus`.
  Monster sheets are not exempt — the tracker and player view read these
  paths regardless of actor kind.
- **`bestiary_mapper` maps a Bestiary Entry to Actor-shaped sheet data**
  using the same dotted-path helpers (`set_sheet_value`).

## When this doesn't fit

A ruleset whose model truly cannot be expressed as config (radically
different resolution mechanics) may need behavior hooks beyond data keys.
Add the hook to the config contract, implement it in the ruleset module,
and update this blueprint's required-keys list in the same commit. Do not
work around the config dict with edition checks in the core.
