"""
Pathfinder 1e ruleset configuration.
Defines skills, saves, and ability modifiers for 1e campaigns.
"""

from .common import build_pathfinder_1e_actor_sheet, build_pathfinder_1e_monster_sheet, map_bestiary_entry_to_actor

ABILITIES = ["str", "dex", "con", "int", "wis", "cha"]

SKILLS_1E = {
    "acrobatics": "dex",
    "animal_handling": "wis",
    "appraise": "int",
    "bluff": "cha",
    "climb": "str",
    "craft": "int",
    "diplomacy": "cha",
    "disable_device": "dex",
    "disguise": "cha",
    "escape_artist": "dex",
    "fly": "dex",
    "handle_animal": "cha",
    "heal": "wis",
    "intimidate": "cha",
    "knowledge_arcana": "int",
    "knowledge_dungeoneering": "int",
    "knowledge_engineering": "int",
    "knowledge_geography": "int",
    "knowledge_history": "int",
    "knowledge_local": "int",
    "knowledge_nature": "int",
    "knowledge_nobility": "int",
    "knowledge_planes": "int",
    "knowledge_religion": "int",
    "linguistics": "int",
    "perception": "wis",
    "perform": "cha",
    "profession": "wis",
    "ride": "dex",
    "sense_motive": "wis",
    "sleight_of_hand": "dex",
    "spellcraft": "int",
    "stealth": "dex",
    "survival": "wis",
    "swim": "str",
    "use_magic_device": "cha",
}

SAVES_1E = ["fort", "ref", "will"]

# Fantasy races used by the name generator's actor category.
RACES_1E = ["human", "elf", "dwarf", "gnome", "halfling", "half-orc"]

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
