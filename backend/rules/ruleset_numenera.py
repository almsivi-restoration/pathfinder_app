"""
Numenera ruleset configuration.
Defines the Cypher System stat pools, tiers, and sheet definitions for
Numenera campaigns. No bestiary mapper: Numenera creature entries are
narrative stat blocks, not a CSV the bestiary importer can parse — the
creature sheet is built by hand in the actor form instead.
"""

from .common import build_numenera_actor_sheet, build_numenera_creature_sheet

# The three stat pools. Might doubles as hp.current/hp.max (see the actor sheet).
ABILITIES_NUMENERA = ["might", "speed", "intellect"]

# Numenera skills are freeform (trained/specialized per skill), so there is no
# canonical skill list; the sheet collects them as a free-form collection.
SKILLS_NUMENERA = {}

# The Cypher System has no saving throws.
SAVES_NUMENERA = []

# Actors are human by default; visitants cover the rare non-human PC. Unknown
# races fall back to the name generator's generic bank.
RACES_NUMENERA = ["human", "visitant"]

RULESET_CONFIG_NUMENERA = {
    "name": "Numenera",
    "reference_directory": "numenera",
    "races": RACES_NUMENERA,
    "abilities": ABILITIES_NUMENERA,
    "skills": SKILLS_NUMENERA,
    "saves": SAVES_NUMENERA,
    # Tiers, not levels: 6 maximum.
    "max_level": 6,
    # The Cypher System has no ability-score modifiers (difficulty x 3 is the
    # target number). Required by the config contract; the core never calls it.
    "ability_modifier_calc": lambda ability_score: 0,
    "actor_sheet": build_numenera_actor_sheet(),
    "monster_sheet": build_numenera_creature_sheet(),
}
