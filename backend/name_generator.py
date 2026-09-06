"""Random fantasy name generation for the GM Tools menu.

Syllable-based generators produce names at runtime; nothing is stored.
Actor names vary by the ruleset's fantasy races (registered under each
ruleset's ``name_categories``); places, items, factions, and events are
ruleset-neutral.
"""

import random
from typing import Dict, List, Optional

# --- Syllable banks ---------------------------------------------------------

_HUMAN = {
    "onset": ["Al", "Ber", "Cor", "Dar", "Ed", "Gar", "Hal", "Jon", "Mar", "Rod", "Thed", "Wil"],
    "vowel": ["a", "e", "i", "o", "u", "y"],
    "coda": ["ric", "win", "mund", "fred", "bert", "wick", "ford", "son", "ley", "ton"],
}
_ELF = {
    "onset": ["Ael", "Cel", "El", "Gal", "Ily", "Lae", "Nim", "Syl", "Thal", "Vae"],
    "vowel": ["a", "e", "i", "ia", "ae"],
    "coda": ["rian", "lith", "nor", "wen", "driel", "thor", "miel", "rond", "lis"],
}
_DWARF = {
    "onset": ["Bal", "Dor", "Dur", "Gim", "Kaz", "Mor", "Thor", "Thra", "Brum", "Har"],
    "vowel": ["a", "o", "u", "i"],
    "coda": ["din", "grim", "li", "in", "bek", "gar", "nur", "dek", "kaz"],
}
_ORC = {
    "onset": ["Grash", "Mog", "Ur", "Zug", "Karg", "Dro", "Bol", "Throk", "Nar", "Gor"],
    "vowel": ["a", "o", "u"],
    "coda": ["gash", "nak", "zug", "tok", "mash", "gore", "ruk", "dur"],
}
_GNOME = {
    "onset": ["Bim", "Fiz", "Gri", "Nib", "Pip", "Quil", "Tib", "Wim", "Zil"],
    "vowel": ["i", "e", "y", "oo"],
    "coda": ["ble", "wick", "fizz", "whistle", "gear", "tinker", "nook", "sprocket"],
}
_HALFLING = {
    "onset": ["Bil", "Cor", "Dro", "Ham", "Mun", "Per", "Ros", "Sam", "Tol"],
    "vowel": ["a", "o", "i", "y"],
    "coda": ["bo", "go", "burr", "foot", "banks", "hill", "gard", "wise"],
}
_GENERIC = _HUMAN

_RACE_BANKS: Dict[str, Dict[str, List[str]]] = {
    "human": _HUMAN,
    "elf": _ELF,
    "dwarf": _DWARF,
    "orc": _ORC,
    "half-orc": _ORC,
    "gnome": _GNOME,
    "halfling": _HALFLING,
}

_PLACE_PREFIX = ["Oak", "Stone", "Raven", "Gold", "Iron", "Thorn", "Mist", "Ember", "Frost", "Bright"]
_PLACE_GEO = {
    "continent": ["arheim", "andor", "essia", "ovia", "undar"],
    "kingdom": ["mark", "reach", "hold", "vale", "shire", "land"],
    "city": ["burg", "haven", "gate", "ford", "port", "fall", "spire"],
    "town": ["brook", "field", "mill", "stead", "hollow", "crossing"],
    "building": ["tavern", "keep", "tower", "hall", "shrine", "mill", "inn"],
}
_PLACE_DESCRIPTORS = ["Wayfarer's", "Gilded", "Broken", "Silent", "Wandering", "Crowned", "Ashen"]
_PLACE_NOUNS = ["Tankard", "Griffin", "Lantern", "Anvil", "Rose", "Flail", "Hearth", "Spire"]

_ITEM_ADJ = ["Ember", "Frost", "Shadow", "Dawn", "Storm", "Rune", "Gloom", "Star", "Blood", "Iron"]
_ITEM_NOUN = ["brand", "edge", "fang", "bane", "caller", "ward", "song", "shard", "veil", "crown"]
_ITEM_KIND = ["Sword", "Blade", "Bow", "Staff", "Amulet", "Ring", "Shield", "Tome", "Dagger", "Mace"]

_FACTION_ADJ = ["Crimson", "Obsidian", "Silver", "Golden", "Ashen", "Verdant", "Umbral", "Ivory"]
_FACTION_NOUN = ["Hand", "Order", "Covenant", "Syndicate", "Circle", "Blades", "Veil", "Compact"]
_FACTION_SUFFIX = ["of the Dawn", "of Shadows", "of the Nine", "of the Deep", "Unbroken", "Eternal"]

_EVENT_ADJ = ["Sundering", "Long", "Crimson", "Silent", "Burning", "Shattered", "Golden", "Last"]
_EVENT_NOUN = ["Night", "War", "Siege", "Plague", "Convergence", "Rising", "Fall", "Treaty", "Schism"]


def _syllable_name(bank: Dict[str, List[str]]) -> str:
    name = random.choice(bank["onset"])
    for _ in range(random.randint(1, 2)):
        name += random.choice(bank["vowel"]) + random.choice(bank["coda"])
    return name


def _actor_name(race: Optional[str]) -> str:
    bank = _RACE_BANKS.get((race or "").lower(), _GENERIC)
    return _syllable_name(bank)


def _place_name(level: str) -> str:
    level = (level or "city").lower()
    if level == "building":
        return f"The {random.choice(_PLACE_DESCRIPTORS)} {random.choice(_PLACE_NOUNS)}"
    stem = random.choice(_PLACE_PREFIX) + random.choice(_PLACE_GEO.get(level, _PLACE_GEO["city"]))
    return stem.capitalize()


def _item_name() -> str:
    return f"{random.choice(_ITEM_ADJ)}{random.choice(_ITEM_NOUN)} ({random.choice(_ITEM_KIND)})"


def _faction_name() -> str:
    base = f"The {random.choice(_FACTION_ADJ)} {random.choice(_FACTION_NOUN)}"
    if random.random() < 0.5:
        base += f" {random.choice(_FACTION_SUFFIX)}"
    return base


def _event_name() -> str:
    return f"The {random.choice(_EVENT_ADJ)} {random.choice(_EVENT_NOUN)}"


_CATEGORIES = ["actor", "place", "item", "faction", "event"]
_PLACE_LEVELS = ["continent", "kingdom", "city", "town", "building"]


def generate_names(
    category: str,
    count: int = 5,
    race: Optional[str] = None,
    place_level: Optional[str] = None,
) -> List[str]:
    """Generate ``count`` names for a category. Raises ValueError on bad input."""
    category = (category or "").lower()
    count = max(1, min(count, 20))
    if category not in _CATEGORIES:
        raise ValueError(f"Unknown category: {category}")
    if category == "actor":
        return [_actor_name(race) for _ in range(count)]
    if category == "place":
        level = (place_level or "city").lower()
        if level not in _PLACE_LEVELS:
            raise ValueError(f"Unknown place level: {level}")
        return [_place_name(level) for _ in range(count)]
    if category == "item":
        return [_item_name() for _ in range(count)]
    if category == "faction":
        return [_faction_name() for _ in range(count)]
    return [_event_name() for _ in range(count)]


def list_categories() -> Dict[str, object]:
    """Describe the generator categories for the UI."""
    return {
        "categories": _CATEGORIES,
        "place_levels": _PLACE_LEVELS,
    }
