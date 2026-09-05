"""Reusable primitives for declarative ruleset sheet definitions."""

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