"""Reusable primitives for declarative ruleset sheet definitions."""

import json
from typing import Any, Dict, Iterable


def get_sheet_value(sheet: Dict[str, Any], path: str, default: Any = None) -> Any:
    """Read a dotted path from a ruleset-defined actor sheet."""
    value = sheet
    for segment in path.split("."):
        if not isinstance(value, dict) or segment not in value:
            return default
        value = value[segment]
    return value


def set_sheet_value(sheet: Dict[str, Any], path: str, value: Any) -> None:
    """Set a dotted path on an actor sheet, creating intermediate groups."""
    target = sheet
    segments = path.split(".")
    for segment in segments[:-1]:
        target = target.setdefault(segment, {})
    target[segments[-1]] = value


def build_pathfinder_actor_sheet(skills: Dict[str, str], saves: Iterable[str]) -> Dict[str, Any]:
    """Return the shared Pathfinder character-sheet template definition."""
    fields = [
        {"key": "hp.current", "label": "Current HP", "type": "number", "default": 10, "section": "Combat"},
        {"key": "hp.max", "label": "Max HP", "type": "number", "default": 10, "section": "Combat"},
        {"key": "defenses.ac", "label": "Armor Class", "type": "number", "default": 10, "section": "Combat"},
        {"key": "initiative.bonus", "label": "Initiative Bonus", "type": "number", "default": 0, "section": "Combat"},
        {"key": "movement.speed", "label": "Speed", "type": "number", "default": 30, "section": "Combat"},
    ]
    fields.extend(
        {
            "key": f"abilities.{ability}",
            "label": ability.upper(),
            "type": "number",
            "default": 10,
            "section": "Abilities",
        }
        for ability in ["str", "dex", "con", "int", "wis", "cha"]
    )
    fields.extend(
        {
            "key": f"saves.{save}",
            "label": save.title(),
            "type": "number",
            "default": 0,
            "section": "Saving Throws",
        }
        for save in saves
    )
    fields.extend(
        {
            "key": f"skills.{skill}",
            "label": f"{skill.replace('_', ' ').title()} ({ability.upper()})",
            "type": "number",
            "default": 0,
            "section": "Skills",
        }
        for skill, ability in skills.items()
    )
    return {
        "fields": fields,
        "summary": [
            {"label": "HP", "value_key": "hp.current", "secondary_key": "hp.max"},
            {"label": "AC", "value_key": "defenses.ac"},
            {"label": "Init", "value_key": "initiative.bonus", "signed": True},
        ],
        "player_resource": {
            "label": "HP",
            "current_key": "hp.current",
            "max_key": "hp.max",
        },
        "initiative": {"bonus_key": "initiative.bonus"},
    }


def build_pathfinder_1e_actor_sheet(skills: Dict[str, str], saves: Iterable[str]) -> Dict[str, Any]:
    """Return a field definition matching the Pathfinder 1e two-page character sheet."""
    actor_sheet = build_pathfinder_actor_sheet({}, [])
    fields = actor_sheet["fields"]
    fields.extend([
        {"key": "character.alignment", "label": "Alignment", "type": "text", "default": "", "section": "Character"},
        {"key": "character.level", "label": "Character Level", "type": "number", "default": 1, "section": "Character"},
        {"key": "character.deity", "label": "Deity", "type": "text", "default": "", "section": "Character"},
        {"key": "character.homeland", "label": "Homeland", "type": "text", "default": "", "section": "Character"},
        {"key": "character.race", "label": "Race", "type": "text", "default": "", "section": "Character"},
        {"key": "character.size", "label": "Size", "type": "text", "default": "Medium", "section": "Character"},
        {"key": "character.gender", "label": "Gender", "type": "text", "default": "", "section": "Character"},
        {"key": "character.age", "label": "Age", "type": "number", "default": "", "section": "Character"},
        {"key": "character.height", "label": "Height", "type": "text", "default": "", "section": "Character"},
        {"key": "character.weight", "label": "Weight", "type": "text", "default": "", "section": "Character"},
        {"key": "character.hair", "label": "Hair", "type": "text", "default": "", "section": "Character"},
        {"key": "character.eyes", "label": "Eyes", "type": "text", "default": "", "section": "Character"},
        {"key": "hp.nonlethal_damage", "label": "Nonlethal Damage", "type": "number", "default": 0, "section": "Health & Movement"},
        {"key": "defenses.damage_reduction", "label": "Damage Reduction", "type": "text", "default": "", "section": "Health & Movement"},
        {"key": "movement.base_speed", "label": "Base Speed", "type": "number", "default": 30, "section": "Health & Movement"},
        {"key": "movement.with_armor", "label": "Speed With Armor", "type": "number", "default": 30, "section": "Health & Movement"},
        {"key": "movement.fly", "label": "Fly", "type": "number", "default": 0, "section": "Health & Movement"},
        {"key": "movement.fly_maneuverability", "label": "Fly Maneuverability", "type": "text", "default": "", "section": "Health & Movement"},
        {"key": "movement.swim", "label": "Swim", "type": "number", "default": 0, "section": "Health & Movement"},
        {"key": "movement.climb", "label": "Climb", "type": "number", "default": 0, "section": "Health & Movement"},
        {"key": "movement.burrow", "label": "Burrow", "type": "number", "default": 0, "section": "Health & Movement"},
        {"key": "defenses.touch_ac", "label": "Touch AC", "type": "number", "default": 10, "section": "Defenses"},
        {"key": "defenses.flat_footed_ac", "label": "Flat-Footed AC", "type": "number", "default": 10, "section": "Defenses"},
        {"key": "defenses.spell_resistance", "label": "Spell Resistance", "type": "number", "default": 0, "section": "Defenses"},
        {"key": "combat.base_attack_bonus", "label": "Base Attack Bonus", "type": "number", "default": 0, "section": "Combat"},
        {"key": "combat.cmb", "label": "CMB", "type": "number", "default": 0, "section": "Combat"},
        {"key": "combat.cmd", "label": "CMD", "type": "number", "default": 10, "section": "Combat"},
        {"key": "abilities.str.temp_adjustment", "label": "STR Temp Adjustment", "type": "number", "default": 0, "section": "Ability Adjustments"},
        {"key": "abilities.dex.temp_adjustment", "label": "DEX Temp Adjustment", "type": "number", "default": 0, "section": "Ability Adjustments"},
        {"key": "abilities.con.temp_adjustment", "label": "CON Temp Adjustment", "type": "number", "default": 0, "section": "Ability Adjustments"},
        {"key": "abilities.int.temp_adjustment", "label": "INT Temp Adjustment", "type": "number", "default": 0, "section": "Ability Adjustments"},
        {"key": "abilities.wis.temp_adjustment", "label": "WIS Temp Adjustment", "type": "number", "default": 0, "section": "Ability Adjustments"},
        {"key": "abilities.cha.temp_adjustment", "label": "CHA Temp Adjustment", "type": "number", "default": 0, "section": "Ability Adjustments"},
        {"key": "saves", "label": "Saving Throws", "type": "collection", "section": "Defenses", "default": [
            {"name": "Fortitude", "ability": "CON", "total": 0, "base": 0, "ability_modifier": 0, "magic": 0, "misc": 0, "temporary": 0},
            {"name": "Reflex", "ability": "DEX", "total": 0, "base": 0, "ability_modifier": 0, "magic": 0, "misc": 0, "temporary": 0},
            {"name": "Will", "ability": "WIS", "total": 0, "base": 0, "ability_modifier": 0, "magic": 0, "misc": 0, "temporary": 0},
        ], "item_fields": [
            {"key": "name", "label": "Save", "type": "text", "default": ""},
            {"key": "ability", "label": "Ability", "type": "text", "default": ""},
            {"key": "total", "label": "Total", "type": "number", "default": 0},
            {"key": "base", "label": "Base", "type": "number", "default": 0},
            {"key": "ability_modifier", "label": "Ability Mod.", "type": "number", "default": 0},
            {"key": "magic", "label": "Magic", "type": "number", "default": 0},
            {"key": "misc", "label": "Misc.", "type": "number", "default": 0},
            {"key": "temporary", "label": "Temporary", "type": "number", "default": 0},
        ]},
        {"key": "skills", "label": "Skills", "type": "collection", "section": "Skills", "default": [
            {"name": skill.replace("_", " ").title(), "ability": ability.upper(), "class_skill": False, "trained_only": skill in {"disable_device", "handle_animal", "knowledge_arcana", "knowledge_dungeoneering", "knowledge_engineering", "knowledge_geography", "knowledge_history", "knowledge_local", "knowledge_nature", "knowledge_nobility", "knowledge_planes", "knowledge_religion", "linguistics", "profession", "sleight_of_hand", "spellcraft", "use_magic_device"}, "total": 0, "ranks": 0, "misc": 0}
            for skill, ability in skills.items()
        ], "item_fields": [
            {"key": "name", "label": "Skill", "type": "text", "default": ""},
            {"key": "ability", "label": "Ability", "type": "text", "default": ""},
            {"key": "class_skill", "label": "Class", "type": "checkbox", "default": False},
            {"key": "trained_only", "label": "Trained", "type": "checkbox", "default": False},
            {"key": "total", "label": "Total", "type": "number", "default": 0},
            {"key": "ranks", "label": "Ranks", "type": "number", "default": 0},
            {"key": "misc", "label": "Misc.", "type": "number", "default": 0},
        ]},
        {"key": "weapons", "label": "Weapons", "type": "collection", "section": "Weapons", "default": [], "item_fields": [
            {"key": "name", "label": "Weapon", "type": "text", "default": ""},
            {"key": "attack_bonus", "label": "Attack Bonus", "type": "number", "default": 0},
            {"key": "critical", "label": "Critical", "type": "text", "default": ""},
            {"key": "type", "label": "Type", "type": "text", "default": ""},
            {"key": "range", "label": "Range", "type": "text", "default": ""},
            {"key": "ammunition", "label": "Ammunition", "type": "text", "default": ""},
            {"key": "damage", "label": "Damage", "type": "text", "default": ""},
        ]},
        {"key": "armor_items", "label": "Armor & Protective Items", "type": "collection", "section": "Equipment", "default": [], "item_fields": [
            {"key": "name", "label": "Item", "type": "text", "default": ""},
            {"key": "bonus", "label": "Bonus", "type": "number", "default": 0},
            {"key": "type", "label": "Type", "type": "text", "default": ""},
            {"key": "check_penalty", "label": "Check Penalty", "type": "number", "default": 0},
            {"key": "spell_failure", "label": "Spell Failure", "type": "text", "default": ""},
            {"key": "weight", "label": "Weight", "type": "number", "default": 0},
            {"key": "properties", "label": "Properties", "type": "text", "default": ""},
        ]},
        {"key": "gear", "label": "Gear", "type": "collection", "section": "Equipment", "default": [], "item_fields": [
            {"key": "name", "label": "Item", "type": "text", "default": ""},
            {"key": "weight", "label": "Weight", "type": "number", "default": 0},
        ]},
        {"key": "encumbrance.total_weight", "label": "Total Weight", "type": "number", "default": 0, "section": "Equipment"},
        {"key": "encumbrance.light_load", "label": "Light Load", "type": "number", "default": 0, "section": "Equipment"},
        {"key": "encumbrance.medium_load", "label": "Medium Load", "type": "number", "default": 0, "section": "Equipment"},
        {"key": "encumbrance.heavy_load", "label": "Heavy Load", "type": "number", "default": 0, "section": "Equipment"},
        {"key": "encumbrance.lift_over_head", "label": "Lift Over Head", "type": "number", "default": 0, "section": "Equipment"},
        {"key": "encumbrance.lift_off_ground", "label": "Lift Off Ground", "type": "number", "default": 0, "section": "Equipment"},
        {"key": "encumbrance.drag_or_push", "label": "Drag or Push", "type": "number", "default": 0, "section": "Equipment"},
        {"key": "currency.cp", "label": "CP", "type": "number", "default": 0, "section": "Currency & Experience"},
        {"key": "currency.sp", "label": "SP", "type": "number", "default": 0, "section": "Currency & Experience"},
        {"key": "currency.gp", "label": "GP", "type": "number", "default": 0, "section": "Currency & Experience"},
        {"key": "currency.pp", "label": "PP", "type": "number", "default": 0, "section": "Currency & Experience"},
        {"key": "experience.current", "label": "Experience Points", "type": "number", "default": 0, "section": "Currency & Experience"},
        {"key": "experience.next_level", "label": "Next Level", "type": "number", "default": 0, "section": "Currency & Experience"},
        {"key": "feats", "label": "Feats", "type": "textarea", "default": "", "section": "Features & Magic"},
        {"key": "special_abilities", "label": "Special Abilities", "type": "textarea", "default": "", "section": "Features & Magic"},
        {"key": "languages", "label": "Languages", "type": "textarea", "default": "", "section": "Features & Magic"},
        {"key": "conditional_modifiers", "label": "Conditional Modifiers", "type": "textarea", "default": "", "section": "Features & Magic"},
        {"key": "spellcasting.domains_or_school", "label": "Domains / Specialty School", "type": "text", "default": "", "section": "Features & Magic"},
        {"key": "spells", "label": "Spells", "type": "collection", "section": "Features & Magic", "default": [], "item_fields": [
            {"key": "level", "label": "Level", "type": "text", "default": "0"},
            {"key": "name", "label": "Spell", "type": "text", "default": ""},
            {"key": "known", "label": "Known", "type": "checkbox", "default": False},
            {"key": "save_dc", "label": "Save DC", "type": "number", "default": 0},
            {"key": "per_day", "label": "Per Day", "type": "number", "default": 0},
            {"key": "bonus", "label": "Bonus", "type": "number", "default": 0},
        ]},
    ])
    return actor_sheet


def build_pathfinder_2e_actor_sheet(skills: Dict[str, str], saves: Iterable[str]) -> Dict[str, Any]:
    """Return a field definition matching the Pathfinder 2e four-page character sheet."""
    actor_sheet = build_pathfinder_actor_sheet({}, [])
    fields = actor_sheet["fields"]
    fields.extend([
        {"key": "character.level", "label": "Level", "type": "number", "default": 1, "section": "Character"},
        {"key": "character.xp", "label": "XP", "type": "number", "default": 0, "section": "Character"},
        {"key": "character.hero_points", "label": "Hero Points", "type": "number", "default": 0, "section": "Character"},
        {"key": "character.ancestry", "label": "Ancestry", "type": "text", "default": "", "section": "Character"},
        {"key": "character.heritage_traits", "label": "Heritage & Traits", "type": "textarea", "default": "", "section": "Character"},
        {"key": "character.size", "label": "Size", "type": "text", "default": "Medium", "section": "Character"},
        {"key": "character.background", "label": "Background", "type": "text", "default": "", "section": "Character"},
        {"key": "character.background_notes", "label": "Background Notes", "type": "textarea", "default": "", "section": "Character"},
        {"key": "character.class", "label": "Class", "type": "text", "default": "", "section": "Character"},
        {"key": "character.class_notes", "label": "Class Notes", "type": "textarea", "default": "", "section": "Character"},
        {"key": "hp.temporary", "label": "Temporary HP", "type": "number", "default": 0, "section": "Hit Points & Conditions"},
        {"key": "hp.dying", "label": "Dying", "type": "number", "default": 0, "section": "Hit Points & Conditions"},
        {"key": "hp.wounded", "label": "Wounded", "type": "number", "default": 0, "section": "Hit Points & Conditions"},
        {"key": "defenses.resistances_immunities", "label": "Resistances & Immunities", "type": "textarea", "default": "", "section": "Hit Points & Conditions"},
        {"key": "conditions", "label": "Conditions", "type": "textarea", "default": "", "section": "Hit Points & Conditions"},
        {"key": "defenses.shield_hardness", "label": "Shield Hardness", "type": "number", "default": 0, "section": "Defenses"},
        {"key": "defenses.shield_max_hp", "label": "Shield Max HP", "type": "number", "default": 0, "section": "Defenses"},
        {"key": "defenses.shield_bt", "label": "Shield BT", "type": "number", "default": 0, "section": "Defenses"},
        {"key": "defenses.shield_hp", "label": "Shield HP", "type": "number", "default": 0, "section": "Defenses"},
        {"key": "perception.total", "label": "Perception", "type": "number", "default": 0, "section": "Perception & Movement"},
        {"key": "perception.notes", "label": "Senses & Notes", "type": "textarea", "default": "", "section": "Perception & Movement"},
        {"key": "movement.special", "label": "Special Movement", "type": "textarea", "default": "", "section": "Perception & Movement"},
        {"key": "saves", "label": "Saving Throws", "type": "collection", "section": "Defenses", "default": [
            {"name": "Fortitude", "key_ability": "CON", "rank": "Untrained", "total": 0, "proficiency": 0, "item": 0},
            {"name": "Reflex", "key_ability": "DEX", "rank": "Untrained", "total": 0, "proficiency": 0, "item": 0},
            {"name": "Will", "key_ability": "WIS", "rank": "Untrained", "total": 0, "proficiency": 0, "item": 0},
        ], "item_fields": [
            {"key": "name", "label": "Save", "type": "text", "default": ""},
            {"key": "key_ability", "label": "Key", "type": "text", "default": ""},
            {"key": "rank", "label": "Rank", "type": "text", "default": "Untrained"},
            {"key": "total", "label": "Total", "type": "number", "default": 0},
            {"key": "proficiency", "label": "Prof.", "type": "number", "default": 0},
            {"key": "item", "label": "Item", "type": "number", "default": 0},
        ]},
        {"key": "skills", "label": "Skills", "type": "collection", "section": "Skills", "default": [
            {"name": skill.replace("_", " ").title(), "key_ability": ability.upper(), "rank": "Untrained", "total": 0, "proficiency": 0, "item": 0, "armor": 0, "notes": ""}
            for skill, ability in skills.items()
        ], "item_fields": [
            {"key": "name", "label": "Skill", "type": "text", "default": ""},
            {"key": "key_ability", "label": "Key", "type": "text", "default": ""},
            {"key": "rank", "label": "Rank", "type": "text", "default": "Untrained"},
            {"key": "total", "label": "Total", "type": "number", "default": 0},
            {"key": "proficiency", "label": "Prof.", "type": "number", "default": 0},
            {"key": "item", "label": "Item", "type": "number", "default": 0},
            {"key": "armor", "label": "Armor", "type": "number", "default": 0},
            {"key": "notes", "label": "Notes", "type": "text", "default": ""},
        ]},
        {"key": "strikes", "label": "Strikes", "type": "collection", "section": "Strikes", "default": [], "item_fields": [
            {"key": "category", "label": "Melee / Ranged", "type": "text", "default": "Melee"},
            {"key": "name", "label": "Weapon", "type": "text", "default": ""},
            {"key": "actions", "label": "Actions", "type": "text", "default": ""},
            {"key": "attack_bonus", "label": "Attack", "type": "number", "default": 0},
            {"key": "damage", "label": "Damage", "type": "text", "default": ""},
            {"key": "damage_type", "label": "Type", "type": "text", "default": ""},
            {"key": "traits_notes", "label": "Traits & Notes", "type": "text", "default": ""},
        ]},
        {"key": "proficiencies", "label": "Armor & Weapon Proficiencies", "type": "collection", "section": "Proficiencies", "default": [], "item_fields": [
            {"key": "category", "label": "Category", "type": "text", "default": ""},
            {"key": "name", "label": "Name", "type": "text", "default": ""},
            {"key": "rank", "label": "Rank", "type": "text", "default": "Untrained"},
            {"key": "notes", "label": "Notes", "type": "text", "default": ""},
        ]},
        {"key": "class_dc", "label": "Class DC", "type": "number", "default": 10, "section": "Proficiencies"},
        {"key": "ancestry_features", "label": "Ancestry & General Feats", "type": "collection", "section": "Features", "default": [], "item_fields": [
            {"key": "level", "label": "Level", "type": "number", "default": 1},
            {"key": "type", "label": "Type", "type": "text", "default": "Ancestry Feat"},
            {"key": "name", "label": "Name", "type": "text", "default": ""},
            {"key": "boosts", "label": "Boosts", "type": "text", "default": ""},
        ]},
        {"key": "class_features", "label": "Class Feats & Features", "type": "collection", "section": "Features", "default": [], "item_fields": [
            {"key": "level", "label": "Level", "type": "number", "default": 1},
            {"key": "type", "label": "Type", "type": "text", "default": "Class Feat"},
            {"key": "name", "label": "Name", "type": "text", "default": ""},
        ]},
        {"key": "inventory", "label": "Inventory", "type": "collection", "section": "Inventory & Wealth", "default": [], "item_fields": [
            {"key": "location", "label": "Held / Worn / Consumable", "type": "text", "default": "Held"},
            {"key": "name", "label": "Item", "type": "text", "default": ""},
            {"key": "bulk", "label": "Bulk", "type": "text", "default": ""},
            {"key": "invested", "label": "Invested", "type": "checkbox", "default": False},
        ]},
        {"key": "bulk.current", "label": "Current Bulk", "type": "text", "default": "", "section": "Inventory & Wealth"},
        {"key": "bulk.encumbered", "label": "Encumbered Bulk", "type": "number", "default": 0, "section": "Inventory & Wealth"},
        {"key": "bulk.maximum", "label": "Maximum Bulk", "type": "number", "default": 0, "section": "Inventory & Wealth"},
        {"key": "wealth.cp", "label": "CP", "type": "number", "default": 0, "section": "Inventory & Wealth"},
        {"key": "wealth.sp", "label": "SP", "type": "number", "default": 0, "section": "Inventory & Wealth"},
        {"key": "wealth.gp", "label": "GP", "type": "number", "default": 0, "section": "Inventory & Wealth"},
        {"key": "wealth.pp", "label": "PP", "type": "number", "default": 0, "section": "Inventory & Wealth"},
        {"key": "character_sketch", "label": "Character Sketch", "type": "textarea", "default": "", "section": "Notes"},
        {"key": "origin_appearance", "label": "Origin & Appearance", "type": "textarea", "default": "", "section": "Notes"},
        {"key": "personality", "label": "Personality", "type": "textarea", "default": "", "section": "Notes"},
        {"key": "campaign_notes", "label": "Campaign Notes", "type": "textarea", "default": "", "section": "Notes"},
        {"key": "actions", "label": "Actions & Activities", "type": "collection", "section": "Actions", "default": [], "item_fields": [
            {"key": "name", "label": "Name", "type": "text", "default": ""},
            {"key": "actions", "label": "Actions", "type": "text", "default": ""},
            {"key": "traits", "label": "Traits", "type": "text", "default": ""},
            {"key": "page", "label": "Page", "type": "text", "default": ""},
            {"key": "effects", "label": "Effects", "type": "text", "default": ""},
        ]},
        {"key": "reactions", "label": "Free Actions & Reactions", "type": "collection", "section": "Actions", "default": [], "item_fields": [
            {"key": "name", "label": "Name", "type": "text", "default": ""},
            {"key": "trigger", "label": "Trigger", "type": "text", "default": ""},
            {"key": "traits", "label": "Traits", "type": "text", "default": ""},
            {"key": "page", "label": "Page", "type": "text", "default": ""},
            {"key": "effects", "label": "Effects", "type": "text", "default": ""},
        ]},
        {"key": "spellcasting.tradition", "label": "Magical Tradition", "type": "text", "default": "", "section": "Spellcasting"},
        {"key": "spellcasting.caster_type", "label": "Prepared / Spontaneous", "type": "text", "default": "", "section": "Spellcasting"},
        {"key": "spellcasting.attack", "label": "Spell Attack", "type": "number", "default": 0, "section": "Spellcasting"},
        {"key": "spellcasting.dc", "label": "Spell DC", "type": "number", "default": 10, "section": "Spellcasting"},
        {"key": "spellcasting.focus_points", "label": "Focus Points", "type": "number", "default": 0, "section": "Spellcasting"},
        {"key": "spells", "label": "Spells", "type": "collection", "section": "Spellcasting", "default": [], "item_fields": [
            {"key": "name", "label": "Name", "type": "text", "default": ""},
            {"key": "rank", "label": "Rank", "type": "number", "default": 1},
            {"key": "actions", "label": "Actions", "type": "text", "default": ""},
            {"key": "prepared", "label": "Prepared", "type": "checkbox", "default": False},
        ]},
        {"key": "focus_spells", "label": "Focus Spells", "type": "collection", "section": "Spellcasting", "default": [], "item_fields": [
            {"key": "name", "label": "Name", "type": "text", "default": ""},
            {"key": "rank", "label": "Rank", "type": "number", "default": 1},
            {"key": "actions", "label": "Actions", "type": "text", "default": ""},
        ]},
        {"key": "innate_spells", "label": "Innate Spells", "type": "collection", "section": "Spellcasting", "default": [], "item_fields": [
            {"key": "name", "label": "Name", "type": "text", "default": ""},
            {"key": "actions", "label": "Actions", "type": "text", "default": ""},
            {"key": "frequency", "label": "Frequency", "type": "text", "default": ""},
        ]},
        {"key": "rituals", "label": "Rituals", "type": "collection", "section": "Spellcasting", "default": [], "item_fields": [
            {"key": "name", "label": "Name", "type": "text", "default": ""},
            {"key": "rank", "label": "Rank", "type": "number", "default": 1},
            {"key": "cost", "label": "Cost", "type": "text", "default": ""},
        ]},
    ])
    return actor_sheet


def build_pathfinder_1e_monster_sheet() -> Dict[str, Any]:
    """Return the Pathfinder 1e monster sheet definition for bestiary-derived NPCs.

    Shares the summary/initiative/player-resource contract keys (hp.current,
    hp.max, defenses.ac, initiative.bonus) with the character sheet so the
    tracker, actor rows, and player view work unchanged; only the field list
    differs.
    """
    fields = [
        {"key": "monster.cr", "label": "CR", "type": "text", "default": "", "section": "Identity"},
        {"key": "monster.xp", "label": "XP", "type": "number", "default": 0, "section": "Identity"},
        {"key": "monster.type", "label": "Type", "type": "text", "default": "", "section": "Identity"},
        {"key": "monster.subtypes", "label": "Subtypes", "type": "text", "default": "", "section": "Identity"},
        {"key": "monster.alignment", "label": "Alignment", "type": "text", "default": "", "section": "Identity"},
        {"key": "monster.size", "label": "Size", "type": "text", "default": "Medium", "section": "Identity"},
        {"key": "hp.current", "label": "Current HP", "type": "number", "default": 1, "section": "Vitals"},
        {"key": "hp.max", "label": "Max HP", "type": "number", "default": 1, "section": "Vitals"},
        {"key": "hp.hd", "label": "Hit Dice", "type": "text", "default": "", "section": "Vitals"},
        {"key": "hp.fast_healing", "label": "Fast Healing", "type": "number", "default": 0, "section": "Vitals"},
        {"key": "hp.regeneration", "label": "Regeneration", "type": "number", "default": 0, "section": "Vitals"},
        {"key": "defenses.ac", "label": "AC", "type": "number", "default": 10, "section": "Defenses"},
        {"key": "defenses.touch_ac", "label": "Touch AC", "type": "number", "default": 10, "section": "Defenses"},
        {"key": "defenses.flat_footed_ac", "label": "Flat-Footed AC", "type": "number", "default": 10, "section": "Defenses"},
        {"key": "defenses.sr", "label": "Spell Resistance", "type": "number", "default": 0, "section": "Defenses"},
        {"key": "defenses.dr", "label": "Damage Reduction", "type": "text", "default": "", "section": "Defenses"},
        {"key": "defenses.immunities", "label": "Immunities", "type": "text", "default": "", "section": "Defenses"},
        {"key": "defenses.resistances", "label": "Resistances", "type": "text", "default": "", "section": "Defenses"},
        {"key": "defenses.weaknesses", "label": "Weaknesses", "type": "text", "default": "", "section": "Defenses"},
        {"key": "defenses.defensive_abilities", "label": "Defensive Abilities", "type": "textarea", "default": "", "section": "Defenses"},
        {"key": "saves", "label": "Saving Throws", "type": "collection", "section": "Defenses", "default": [
            {"name": "Fortitude", "total": 0, "note": ""},
            {"name": "Reflex", "total": 0, "note": ""},
            {"name": "Will", "total": 0, "note": ""},
        ], "item_fields": [
            {"key": "name", "label": "Save", "type": "text", "default": ""},
            {"key": "total", "label": "Total", "type": "number", "default": 0},
            {"key": "note", "label": "Notes", "type": "text", "default": ""},
        ]},
        {"key": "initiative.bonus", "label": "Initiative Bonus", "type": "number", "default": 0, "section": "Offense"},
        {"key": "movement.speeds", "label": "Speed", "type": "text", "default": "", "section": "Offense"},
        {"key": "offense.space", "label": "Space", "type": "text", "default": "", "section": "Offense"},
        {"key": "offense.reach", "label": "Reach", "type": "text", "default": "", "section": "Offense"},
        {"key": "combat.bab", "label": "Base Attack Bonus", "type": "number", "default": 0, "section": "Offense"},
        {"key": "combat.cmb", "label": "CMB", "type": "text", "default": "", "section": "Offense"},
        {"key": "combat.cmd", "label": "CMD", "type": "text", "default": "", "section": "Offense"},
        {"key": "attacks", "label": "Attacks", "type": "collection", "section": "Offense", "default": [], "item_fields": [
            {"key": "category", "label": "Melee / Ranged", "type": "text", "default": "melee"},
            {"key": "name", "label": "Attack", "type": "text", "default": ""},
            {"key": "text", "label": "Text", "type": "text", "default": ""},
        ]},
        {"key": "offense.special_attacks", "label": "Special Attacks", "type": "textarea", "default": "", "section": "Offense"},
        {"key": "offense.spell_like_abilities", "label": "Spell-Like Abilities", "type": "textarea", "default": "", "section": "Offense"},
        {"key": "offense.spells", "label": "Spells", "type": "textarea", "default": "", "section": "Offense"},
        {"key": "abilities.str", "label": "STR", "type": "text", "default": "", "section": "Abilities"},
        {"key": "abilities.dex", "label": "DEX", "type": "text", "default": "", "section": "Abilities"},
        {"key": "abilities.con", "label": "CON", "type": "text", "default": "", "section": "Abilities"},
        {"key": "abilities.int", "label": "INT", "type": "text", "default": "", "section": "Abilities"},
        {"key": "abilities.wis", "label": "WIS", "type": "text", "default": "", "section": "Abilities"},
        {"key": "abilities.cha", "label": "CHA", "type": "text", "default": "", "section": "Abilities"},
        {"key": "skills", "label": "Skills", "type": "collection", "section": "Skills & Feats", "default": [], "item_fields": [
            {"key": "name", "label": "Skill", "type": "text", "default": ""},
            {"key": "total", "label": "Total", "type": "text", "default": ""},
            {"key": "note", "label": "Notes", "type": "text", "default": ""},
        ]},
        {"key": "monster.feats", "label": "Feats", "type": "textarea", "default": "", "section": "Skills & Feats"},
        {"key": "monster.languages", "label": "Languages", "type": "textarea", "default": "", "section": "Skills & Feats"},
        {"key": "monster.senses", "label": "Senses", "type": "textarea", "default": "", "section": "Special"},
        {"key": "monster.auras", "label": "Auras", "type": "textarea", "default": "", "section": "Special"},
        {"key": "monster.special_abilities", "label": "Special Abilities", "type": "textarea", "default": "", "section": "Special"},
        {"key": "monster.special_qualities", "label": "Special Qualities", "type": "textarea", "default": "", "section": "Special"},
        {"key": "monster.environment", "label": "Environment", "type": "text", "default": "", "section": "Ecology"},
        {"key": "monster.organization", "label": "Organization", "type": "text", "default": "", "section": "Ecology"},
        {"key": "monster.treasure", "label": "Treasure", "type": "text", "default": "", "section": "Ecology"},
        {"key": "monster.description", "label": "Description", "type": "textarea", "default": "", "section": "Ecology"},
        {"key": "bestiary.source", "label": "Bestiary Source", "type": "text", "default": "", "section": "Ecology"},
        {"key": "bestiary.url", "label": "Bestiary URL", "type": "text", "default": "", "section": "Ecology"},
    ]
    return {
        "fields": fields,
        "summary": [
            {"label": "HP", "value_key": "hp.current", "secondary_key": "hp.max"},
            {"label": "AC", "value_key": "defenses.ac"},
            {"label": "Init", "value_key": "initiative.bonus", "signed": True},
        ],
        "player_resource": {
            "label": "HP",
            "current_key": "hp.current",
            "max_key": "hp.max",
        },
        "initiative": {"bonus_key": "initiative.bonus"},
    }


# Group keys that are numeric distances and get a " ft." suffix; others are labels.
_DISTANCE_GROUP_KEYS = {
    "base", "fly", "swim", "climb", "burrow", "jet",
    "darkvision", "blindsight", "blindsense", "tremorsense", "low-light vision",
}


def _format_kv_group(group: Dict[str, Any], default_unit: str = "") -> str:
    """Render a parsed CSV group dict (speeds, senses, resistances) as display text."""
    parts = []
    for key, value in group.items():
        label = key.replace("_", " ")
        unit = default_unit if key in _DISTANCE_GROUP_KEYS or key.endswith("vision") else ""
        if value in (True, "TRUE", "true"):
            parts.append(label)
        elif unit:
            parts.append(f"{label} {value}{unit}")
        else:
            parts.append(f"{label} {value}".strip())
    return ", ".join(parts)


def _ability_display(value: Any) -> str:
    """Blank ability scores (construct/undead CON etc.) render as an em dash."""
    if value is None or value == "":
        return "—"
    return str(value)


def map_bestiary_entry_to_sheet(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Map a normalized bestiary record onto the 1e monster sheet data shape."""
    sheet = {
        "monster": {
            "cr": entry.get("cr_display", ""),
            "xp": entry.get("xp") or 0,
            "type": entry.get("type", ""),
            "subtypes": ", ".join(entry.get("subtypes", [])),
            "alignment": entry.get("alignment", ""),
            "size": entry.get("size", ""),
            "feats": ", ".join(entry.get("feats", [])),
            "languages": entry.get("languages", ""),
            "senses": _format_kv_group(entry.get("senses", {}), " ft."),
            "auras": "; ".join(
                f"{aura['name']} ({aura['radius']} ft.{', DC ' + aura['dc'] if aura.get('dc') else ''})"
                for aura in entry.get("auras", [])
            ),
            "special_abilities": "\n\n".join(entry.get("special_abilities", [])),
            "special_qualities": "\n".join(
                str(item) for item in (entry.get("special_qualities") or [])
            ),
            "environment": entry.get("environment", ""),
            "organization": entry.get("organization", ""),
            "treasure": entry.get("treasure", ""),
            "description": entry.get("desc_long", "") or entry.get("desc_short", ""),
        },
        "hp": {
            "current": entry.get("hp", {}).get("total") or 1,
            "max": entry.get("hp", {}).get("total") or 1,
            "hd": entry.get("hp", {}).get("hd", ""),
            "fast_healing": entry.get("hp", {}).get("fast_healing") or 0,
            "regeneration": entry.get("hp", {}).get("regeneration") or 0,
        },
        "defenses": {
            "ac": entry.get("ac", {}).get("total") or 10,
            "touch_ac": entry.get("ac", {}).get("touch") or 10,
            "flat_footed_ac": entry.get("ac", {}).get("flat_footed") or 10,
            "sr": entry.get("sr") or 0,
            "dr": "; ".join(
                f"{dr['amount']}/{dr['weakness']}".strip("/") for dr in entry.get("damage_reduction", [])
            ),
            "immunities": entry.get("immunities", ""),
            "resistances": _format_kv_group(entry.get("resistances", {})),
            "weaknesses": ", ".join(entry.get("weaknesses", [])),
            "defensive_abilities": ", ".join(entry.get("defensive_abilities", [])),
        },
        "saves": [
            {"name": "Fortitude", "total": entry.get("saves", {}).get("fort") or 0, "note": ""},
            {"name": "Reflex", "total": entry.get("saves", {}).get("ref") or 0, "note": ""},
            {"name": "Will", "total": entry.get("saves", {}).get("will") or 0, "note": entry.get("saves", {}).get("other", "")},
        ],
        "initiative": {"bonus": entry.get("initiative", {}).get("bonus") or 0},
        "movement": {"speeds": _format_kv_group(entry.get("speeds", {}), " ft.")},
        "offense": {
            "space": entry.get("space", ""),
            "reach": entry.get("reach", "") or entry.get("reach_other", ""),
            "special_attacks": ", ".join(entry.get("special_attacks", [])),
            "spell_like_abilities": "\n".join(entry.get("spell_like_abilities", [])),
            "spells": "\n".join(entry.get("spells", [])),
        },
        "combat": {
            "bab": entry.get("bab") or 0,
            "cmb": " ".join(filter(None, [
                f"+{entry['cmb']}" if isinstance(entry.get("cmb"), (int, float)) else "",
                entry.get("cmb_other", ""),
            ])).strip(),
            "cmd": " ".join(filter(None, [
                str(entry["cmd"]) if entry.get("cmd") is not None else "",
                entry.get("cmd_other", ""),
            ])).strip(),
        },
        "attacks": [
            {"category": attack.get("category", "melee"), "name": attack.get("name", ""), "text": attack.get("text", "")}
            for attack in entry.get("attacks", [])
        ],
        "abilities": {
            ability: _ability_display(entry.get("abilities", {}).get(ability))
            for ability in ["str", "dex", "con", "int", "wis", "cha"]
        },
        "skills": [
            {"name": skill["name"], "total": "" if skill["total"] is None else str(skill["total"]), "note": skill.get("note", "")}
            for skill in entry.get("skills", [])
        ],
        "bestiary": {
            "entry_id": entry.get("id"),
            "source": "; ".join(
                f"{source['name']} p. {source['page']}".rstrip(" p. ")
                for source in entry.get("sources", [])
            ),
            "url": entry.get("url", ""),
        },
    }
    return sheet


def map_bestiary_entry_to_actor(entry: Dict[str, Any]) -> Dict[str, Any]:
    """Build a new NPC actor payload from a normalized bestiary record."""
    return {
        "name": entry.get("name", ""),
        "is_pc": False,
        "player_name": None,
        "sheet": map_bestiary_entry_to_sheet(entry),
        "notes": json.dumps({"bestiary_entry_id": entry.get("id")}) if entry.get("id") is not None else "",
    }