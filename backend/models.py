from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime


class Ruleset(str, Enum):
    PATHFINDER_1E = "1e"
    PATHFINDER_2E = "2e"


class Effect(BaseModel):
    name: str
    duration_rounds: int
    description: Optional[str] = None


class Weapon(BaseModel):
    name: str
    damage_dice: str  # e.g. "1d8", "2d6+2"
    damage_type: str
    modifier: int = 0


class Actor(BaseModel):
    id: str
    name: str
    player_name: Optional[str] = None  # None for NPCs
    ruleset: Ruleset
    is_pc: bool
    
    # Core attributes
    hp_current: int
    hp_max: int
    ac: int
    initiative_bonus: int
    initiative_roll: Optional[int] = None  # actual rolled value (physical die + bonus), GM-entered
    speed: int
    
    # Abilities (STR, DEX, CON, INT, WIS, CHA)
    abilities: Dict[str, int]  # {"str": 10, "dex": 14, ...}
    
    # Skills (ruleset-dependent)
    skills: Dict[str, int] = Field(default_factory=dict)  # {"acrobatics": 5, ...}
    
    # Saves
    saves: Dict[str, int] = Field(default_factory=dict)  # {"fort": 3, "ref": 2, ...}
    
    # Resistances
    resistances: Dict[str, str] = Field(default_factory=dict)  # {"fire": "10", ...}
    
    # Weapons
    weapons: List[Weapon] = Field(default_factory=list)
    
    # Current effects
    effects: List[Effect] = Field(default_factory=list)
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    notes: str = ""


class Encounter(BaseModel):
    id: str
    name: str
    ruleset: Ruleset
    actors: List[Actor] = Field(default_factory=list)
    initiative_order: List[str] = Field(default_factory=list)  # List of actor IDs
    current_round: int = 0
    current_turn_index: int = 0
    created_at: datetime = Field(default_factory=datetime.now)


class Campaign(BaseModel):
    name: str
    ruleset: Ruleset
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
