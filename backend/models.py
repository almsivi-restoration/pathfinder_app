import re
from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Dict, Any, Literal
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
    color: Optional[str] = None  # GM-assigned marker color (hex), shown on the player view
    # GM-assigned marker symbol id (frontend markerSymbols.js catalog), drawn on the physical base.
    # Unknown ids are kept, not rejected, so a newer catalog's symbols survive an older backend.
    symbol: Optional[str] = Field(default=None, max_length=32)

    # Scene state shared across rulesets.
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


class ChronicleEntry(BaseModel):
    id: str
    title: str
    body: str = ""  # markdown source; rendered client-side
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class Scene(BaseModel):
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
    scenes: List[str] = Field(default_factory=list)  # List of scene IDs
    actor_templates: List[Actor] = Field(default_factory=list)
    chronicle: List[ChronicleEntry] = Field(default_factory=list)  # campaign journal entries
    notes: str = ""

    @model_validator(mode="before")
    @classmethod
    def migrate_legacy_encounters(cls, value: Any) -> Any:
        """Load campaigns saved before encounters were renamed to scenes."""
        if not isinstance(value, dict) or "scenes" in value or "encounters" not in value:
            return value

        campaign = value.copy()
        campaign["scenes"] = campaign.pop("encounters")
        return campaign


VENUE_MAX_SIDE = 100  # cells; the 32x46 usable mat grid fits with room for larger maps split into sections
_VENUE_CELL_KEY = re.compile(r"^(\d{1,3}),(\d{1,3})$")


class VenueEdge(BaseModel):
    """A drawn grid line. side "n" is the top edge of cell (x, y); "w" is its left edge, so the
    bottom/right map border is addressed as y == height / x == width.

    Walls between floor and empty space are derived when rendering and are never stored here;
    edges hold only explicit walls, doors, and secret doors (kind ids from the frontend catalog).
    """
    x: int = Field(ge=0, le=VENUE_MAX_SIDE)
    y: int = Field(ge=0, le=VENUE_MAX_SIDE)
    side: Literal["n", "w"]
    kind: str = Field(min_length=1, max_length=32)


class VenueFeature(BaseModel):
    """A catalog stamp (furniture, stairs, labels, traps...) anchored on one cell."""
    id: str = Field(min_length=1, max_length=64)
    kind: str = Field(min_length=1, max_length=32)
    x: int = Field(ge=0, lt=VENUE_MAX_SIDE)
    y: int = Field(ge=0, lt=VENUE_MAX_SIDE)
    rotation: Literal[0, 90, 180, 270] = 0
    label: str = Field(default="", max_length=80)
    gm_only: bool = False  # stripped server-side before the venue reaches the Venue Screen


class Venue(BaseModel):
    """A campaign-owned grid map. cells is sparse: "x,y" -> terrain id; absent cells are void."""
    id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    notes: str = ""  # GM-only; never sent to the Venue Screen
    grid: Literal["square"] = "square"
    width: int = Field(ge=1, le=VENUE_MAX_SIDE)
    height: int = Field(ge=1, le=VENUE_MAX_SIDE)
    cells: Dict[str, str] = Field(default_factory=dict)
    edges: List[VenueEdge] = Field(default_factory=list)
    features: List[VenueFeature] = Field(default_factory=list, max_length=2000)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    @model_validator(mode="after")
    def check_contents_fit_the_grid(self) -> "Venue":
        for key, terrain in self.cells.items():
            match = _VENUE_CELL_KEY.match(key)
            if not match or int(match[1]) >= self.width or int(match[2]) >= self.height:
                raise ValueError(f"Cell {key!r} is outside the {self.width}x{self.height} venue")
            if not terrain or len(terrain) > 32:
                raise ValueError(f"Cell {key!r} has an invalid terrain id")
        seen_edges = set()
        for edge in self.edges:
            max_x = self.width - 1 if edge.side == "n" else self.width
            max_y = self.height if edge.side == "n" else self.height - 1
            if edge.x > max_x or edge.y > max_y:
                raise ValueError(f"Edge {edge.side} at {edge.x},{edge.y} is outside the venue")
            if (edge.x, edge.y, edge.side) in seen_edges:
                raise ValueError(f"Edge {edge.side} at {edge.x},{edge.y} is listed twice")
            seen_edges.add((edge.x, edge.y, edge.side))
        feature_ids = set()
        for feature in self.features:
            if feature.x >= self.width or feature.y >= self.height:
                raise ValueError(f"Feature {feature.id!r} is outside the venue")
            if feature.id in feature_ids:
                raise ValueError(f"Feature id {feature.id!r} is listed twice")
            feature_ids.add(feature.id)
        return self


class VenueCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    width: int = Field(ge=1, le=VENUE_MAX_SIDE)
    height: int = Field(ge=1, le=VENUE_MAX_SIDE)


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


class ChronicleEntryRequest(BaseModel):
    title: str
    body: str = ""  # markdown source


class ReferenceImportRequest(BaseModel):
    filename: str


class HarrowingConfigRequest(BaseModel):
    base_url: str
    model: str


class HarrowingMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str


class HarrowingChatRequest(BaseModel):
    messages: List[HarrowingMessage]
    use_references: bool = False  # inject campaign rulebook hits into the system prompt
    max_tokens: int = 512
    temperature: float = 0.8
