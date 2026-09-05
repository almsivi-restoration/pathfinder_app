from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict, Any
from datetime import datetime


class Effect(BaseModel):
    name: str
    duration_rounds: int
    description: Optional[str] = None


class Actor(BaseModel):
    id: str
    name: str
    player_name: Optional[str] = None  # None for NPCs
    is_pc: bool

    # Encounter state shared across rulesets.
    initiative_roll: Optional[int] = None  # actual rolled value (physical die + bonus), GM-entered
    effects: List[Effect] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    notes: str = ""
    sheet: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_sheet_fields(cls, value: Any) -> Any:
        """Preserve existing campaign data while moving Pathfinder fields into sheet."""
        if not isinstance(value, dict):
            return value

        actor = value.copy()
        sheet = actor.get("sheet", {}).copy()
        legacy_fields = {
            "hp_current": "hp.current",
            "hp_max": "hp.max",
            "ac": "defenses.ac",
            "initiative_bonus": "initiative.bonus",
            "speed": "movement.speed",
            "abilities": "abilities",
            "skills": "skills",
            "saves": "saves",
            "resistances": "resistances",
            "weapons": "weapons",
        }
        for legacy_key, sheet_path in legacy_fields.items():
            if legacy_key in actor:
                from rules.common import set_sheet_value
                set_sheet_value(sheet, sheet_path, actor.pop(legacy_key))

        if isinstance(sheet.get("skills"), dict):
            sheet["skills"] = [
                {
                    "name": skill_name.replace("_", " ").title(),
                    "total": total,
                    "ranks": 0,
                    "misc": 0,
                }
                for skill_name, total in sheet["skills"].items()
            ]
        if isinstance(sheet.get("saves"), dict):
            sheet["saves"] = [
                {"name": save_name.title(), "total": total, "base": 0, "ability_modifier": 0, "magic": 0, "misc": 0, "temporary": 0}
                for save_name, total in sheet["saves"].items()
            ]
        if isinstance(sheet.get("weapons"), list):
            sheet["weapons"] = [
                {
                    **weapon,
                    "damage": weapon.get("damage", " ".join(filter(None, [weapon.get("damage_dice", ""), weapon.get("damage_type", "")]))),
                    "attack_bonus": weapon.get("attack_bonus", 0),
                }
                for weapon in sheet["weapons"]
            ]
        actor["sheet"] = sheet
        return actor


class Encounter(BaseModel):
    id: str
    name: str
    actors: List[Actor] = Field(default_factory=list)
    initiative_order: List[str] = Field(default_factory=list)  # List of actor IDs
    current_round: int = 0
    current_turn_index: int = 0
    created_at: datetime = Field(default_factory=datetime.now)


class Campaign(BaseModel):
    name: str
    ruleset: str
    created_at: datetime = Field(default_factory=datetime.now)
    encounters: List[str] = Field(default_factory=list)  # List of encounter IDs
    actor_templates: List[Actor] = Field(default_factory=list)
    notes: str = ""


class RollRequest(BaseModel):
    die_type: int = 20  # d20 for attack/save, d100 for percentile, etc.
    modifier: int = 0
    bonus_dice: int = 0  # Extra dice to roll


class RollResult(BaseModel):
    total: int
    die_roll: int
    modifier: int
    bonus_dice_roll: Optional[int] = None


class InitiativeOrderRequest(BaseModel):
    actor_ids: List[str]  # explicit ordering of actor IDs, GM-controlled


class ReferenceImportRequest(BaseModel):
    filename: str
