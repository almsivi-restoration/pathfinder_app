"""
Pathfinder 2e ruleset configuration.
Defines skills, saves, and ability modifiers for 2e campaigns.
"""

from .common import build_pathfinder_2e_actor_sheet

ABILITIES = ["str", "dex", "con", "int", "wis", "cha"]

SKILLS_2E = {
    "acrobatics": "dex",
    "animal_empathy": "cha",
    "arcana": "int",
    "athletics": "str",
    "crafting": "int",
    "deception": "cha",
    "diplomacy": "cha",
    "intimidation": "cha",
    "lore": "int",
    "medicine": "wis",
    "nature": "wis",
    "occultism": "int",
    "performance": "cha",
    "religion": "wis",
    "society": "int",
    "stealth": "dex",
    "survival": "wis",
    "thievery": "dex",
}

SAVES_2E = ["fort", "ref", "will"]

# Ancestries used by the name generator's actor category.
RACES_2E = ["human", "elf", "dwarf", "gnome", "halfling", "orc"]

RULESET_CONFIG_2E = {
    "name": "Pathfinder 2e",
    "reference_directory": "pathfinder_2e",
    "races": RACES_2E,
    "abilities": ABILITIES,
    "skills": SKILLS_2E,
    "saves": SAVES_2E,
    "max_level": 20,
    "ability_modifier_calc": lambda ability_score: (ability_score - 10) // 2,
    "actor_sheet": build_pathfinder_2e_actor_sheet(SKILLS_2E, SAVES_2E),
}
