"""Random fantasy name generation for the GM Tools menu.

Generators produce names at runtime; nothing is stored.

Actors use a weighted per-race syllable grammar: cluster-annotated onsets and
codas whose composition rules (which clusters may follow which vowels) are
tuned per race, so an elf reads like an elf and an orc like an orc instead of
both reading like the same slot machine. Places, items, factions, and events
are ruleset-neutral multi-template engines: each category draws from several
weighted construction patterns, so output varies in shape as well as words.

Batches are deduplicated at the source — a bank that has run dry re-rolls
rather than repeating, so a 20-name batch never shows the same name twice
unless the bank is genuinely exhausted.
"""

import random
import re
from typing import Callable, Dict, List, Optional

# --- Syllable banks ---------------------------------------------------------

# --- Race syllable banks ----------------------------------------------------
# Each race is a grammar: weighted onset/vowel/coda pools, consonant clusters
# that may bridge between syllables, optional suffix endings, and a weighted
# syllable-length choice. The cluster/interlude/ending rules are what carry a
# race's sound; the pools just give them material.

_HUMAN = {
    "onsets": ["Al", "Ber", "Cor", "Dar", "Ed", "Gar", "Hal", "Jon", "Mar", "Rod",
               "Thed", "Wil", "Ald", "Brand", "Ced", "Dun", "Edd", "Ger", "Har",
               "Os", "Rich", "Sig", "Wal", "Wen", "Fred", "God", "Ken", "Mund", "Ran"],
    "vowels": ["a", "e", "i", "o", "u", "a", "e", "o"],
    "codas": ["ric", "mund", "fred", "bert", "wick", "ford", "son", "ley", "ton",
              "win", "ward", "ham", "ley", "ston", "well", "man", "rey", "den"],
    "clusters": ["r", "l", "n", "m", "d", "st", "nd", "ld", "rb", "rm"],
    "interludes": ["er", "an", "is", "or", "en"],
    "endings": {"weight": 0.22, "pool": ["ia", "ey", "a", "ine", "elle", "eth"]},
    "syllables": [(1, 2), (2, 6), (3, 2)],
    "min_len": 4,
    "max_len": 12,
}
_ELF = {
    "onsets": ["Ael", "Cel", "El", "Gal", "Ily", "Lae", "Nim", "Syl", "Thal", "Vae",
               "Aer", "Cal", "Elen", "Fae", "Il", "Lor", "Mel", "Naer", "Ril", "Sel",
               "Taer", "Vor", "Yll", "Ael", "Cael"],
    "vowels": ["a", "e", "i", "ia", "ae", "ie", "a", "e"],
    "codas": ["rian", "lith", "nor", "wen", "driel", "thor", "miel", "rond", "lis",
              "ron", "thas", "niel", "dor", "wyn", "las", "reth", "mir", "ven"],
    "clusters": ["l", "r", "n", "th", "ll", "ss", "ndr", "lr"],
    "interludes": ["a", "ie", "ae", "ia", "e"],
    "endings": {"weight": 0.3, "pool": ["iel", "wen", "wyn", "riel", "elle", "anna", "is"]},
    "syllables": [(1, 1), (2, 5), (3, 3)],
    "min_len": 5,
    "max_len": 14,
}
_DWARF = {
    "onsets": ["Bal", "Dor", "Dur", "Gim", "Kaz", "Mor", "Thor", "Thra", "Brum", "Har",
               "Bar", "Dal", "Dwal", "Far", "Glo", "Gro", "Khaz", "Nor", "Thra", "Bof"],
    "vowels": ["a", "o", "u", "i", "a", "o"],
    "codas": ["din", "grim", "li", "in", "bek", "gar", "nur", "dek", "kaz",
              "rim", "bur", "dal", "grim", "gorn", "rek", "vik", "zan", "dur"],
    "clusters": ["r", "n", "m", "rn", "gr", "dr", "kh", "lm"],
    "interludes": ["a", "i", "u"],
    "endings": {"weight": 0.15, "pool": ["a", "i", "hild", "dis"]},
    "syllables": [(1, 3), (2, 5), (3, 1)],
    "min_len": 4,
    "max_len": 10,
}
_ORC = {
    "onsets": ["Grash", "Mog", "Ur", "Zug", "Karg", "Dro", "Bol", "Throk", "Nar", "Gor",
               "Brak", "Durg", "Ghaz", "Krul", "Mau", "Rok", "Shag", "Ug", "Yak", "Zog"],
    "vowels": ["a", "o", "u", "a", "o"],
    "codas": ["gash", "nak", "zug", "tok", "mash", "gore", "ruk", "dur",
              "gul", "kag", "mog", "nar", "shar", "tusk", "zog", "grash"],
    "clusters": ["g", "k", "r", "z", "gr", "kr", "shk", "rz"],
    "interludes": ["a", "u", "o"],
    "endings": {"weight": 0.1, "pool": ["a", "ka"]},
    "syllables": [(1, 5), (2, 4)],
    "min_len": 3,
    "max_len": 9,
}
_GNOME = {
    "onsets": ["Bim", "Fiz", "Gri", "Nib", "Pip", "Quil", "Tib", "Wim", "Zil",
               "Bink", "Dim", "Flib", "Glim", "Jin", "Nim", "Quib", "Tink", "Wid", "Zib"],
    "vowels": ["i", "e", "y", "oo", "i", "e"],
    "codas": ["ble", "wick", "fizz", "gear", "tinker", "nook", "sprocket",
              "kin", "ley", "wicket", "bin", "fiddle", "gadget", "whim"],
    "clusters": ["b", "t", "k", "w", "mb", "tt", "ck", "gg"],
    "interludes": ["i", "ee", "a"],
    "endings": {"weight": 0.3, "pool": ["y", "ie", "ina", "etta", "wick"]},
    "syllables": [(1, 2), (2, 5), (3, 3)],
    "min_len": 4,
    "max_len": 12,
}
_HALFLING = {
    "onsets": ["Bil", "Cor", "Dro", "Ham", "Mun", "Per", "Ros", "Sam", "Tol",
               "Bun", "Dal", "Fro", "Hol", "Lil", "Mer", "Olo", "Pim", "Rus", "Wil"],
    "vowels": ["a", "o", "i", "y", "e", "o"],
    "codas": ["bo", "go", "burr", "foot", "banks", "hill", "gard", "wise",
              "berry", "field", "meadow", "bottle", "down", "fair", "good", "hay"],
    "clusters": ["b", "d", "l", "m", "mb", "dd", "rr", "tt"],
    "interludes": ["a", "o", "er"],
    "endings": {"weight": 0.28, "pool": ["a", "ie", "y", "etta", "mene", "rose"]},
    "syllables": [(1, 2), (2, 5), (3, 2)],
    "min_len": 4,
    "max_len": 12,
}
_GENERIC = _HUMAN

_RACE_BANKS: Dict[str, Dict] = {
    "human": _HUMAN,
    "elf": _ELF,
    "half-elf": _ELF,
    "dwarf": _DWARF,
    "orc": _ORC,
    "half-orc": _ORC,
    "gnome": _GNOME,
    "halfling": _HALFLING,
}

# --- Word banks (non-actor categories) ---------------------------------------

_PLACE_PREFIX = ["Oak", "Stone", "Raven", "Gold", "Iron", "Thorn", "Mist", "Ember",
                 "Frost", "Bright", "Ash", "Black", "Red", "Silver", "Storm", "White",
                 "Briar", "Crow", "Elm", "Fox", "Grim", "Hawk", "Mill", "Salt",
                 "Wolf", "Birch", "Cedar", "Dun", "Elder", "Fern"]
_PLACE_GEO = {
    "continent": ["arheim", "andor", "essia", "ovia", "undar", "mara", "thule", "verra"],
    "kingdom": ["mark", "reach", "hold", "vale", "shire", "land", "gard", "heim"],
    "city": ["burg", "haven", "gate", "ford", "port", "fall", "spire", "bridge",
             "mouth", "watch", "crest", "market"],
    "town": ["brook", "field", "mill", "stead", "hollow", "crossing", "combe",
             "shaw", "thorpe", "wold", "by", "ham"],
}
_PLACE_WATER = ["mere", "water", "flow", "tide", "springs", "well"]
_PLACE_CARDINAL = ["North", "South", "East", "West", "Upper", "Lower", "New", "Old"]
_PLACE_TITLES = ["Bald", "Duke", "Saint", "King", "Queen", "Baron", "Mother", "Father"]
_PLACE_PERSON = ["Aldric", "Marn", "Tessel", "Hob", "Carrow", "Bess", "Dunmore", "Yorick"]
_PLACE_DESCRIPTORS = ["Wayfarer's", "Gilded", "Broken", "Silent", "Wandering", "Crowned",
                      "Ashen", "Brass", "Copper", "Drunken", "Empty", "Hollow",
                      "Iron", "Laughing", "Leaning", "Prancing", "Rusty", "Salted",
                      "Silver", "Sleeping", "Smiling", "Staggering", "Thirsty", "Weeping"]
_PLACE_NOUNS = ["Tankard", "Griffin", "Lantern", "Anvil", "Rose", "Flail", "Hearth",
                "Spire", "Barrel", "Boar", "Cockatrice", "Cup", "Dagger", "Dragon",
                "Eel", "Fiddle", "Goblet", "Goose", "Hart", "Herring", "Horn",
                "Hound", "Maiden", "Mermaid", "Mule", "Ox", "Pike", "Quill",
                "Rat", "Saddle", "Serpent", "Shovel", "Stag", "Sword", "Wheel"]

_ITEM_ADJ = ["Ember", "Frost", "Shadow", "Dawn", "Storm", "Rune", "Gloom", "Star",
             "Blood", "Iron", "Moon", "Sun", "Night", "Grave", "Wyrm", "Ghost",
             "Thorn", "Winter", "Ashen", "Silent", "Verdant", "Umbral", "Hollow",
             "Bright", "Dread", "Oath"]
_ITEM_NOUN = ["brand", "edge", "fang", "bane", "caller", "ward", "song", "shard",
              "veil", "crown", "rend", "spear", "mourn", "kiss", "howl", "weaver",
              "keeper", "seeker", "binder", "thorn", "grasp", "wake", "whisper"]
_ITEM_KIND = ["Sword", "Blade", "Bow", "Staff", "Amulet", "Ring", "Shield", "Tome",
              "Dagger", "Mace", "Axe", "Spear", "Wand", "Cloak", "Helm", "Orb"]
_ITEM_FOLK = ["Adventurer's", "Pilgrim's", "Widow's", "Shepherd's", "Beggar's",
              "Cartographer's", "Mummer's", "Gravedigger's"]
_ITEM_SLAIN = ["Dragons", "Kings", "Giants", "Wyrms", "Traitors", "Storms", "Oaths", "the Deep"]
_ITEM_ACT = ["Sundering", "Devouring", "Unmaking", "Unbinding", "Kindling", "Hollowing"]
_ITEM_FORGE = ["the Last Forge", "a Drowned Kingdom", "the First Winter",
               "an Unnamed God", "Nine Secret Masters", "the Mountain's Heart"]

_FACTION_ADJ = ["Crimson", "Obsidian", "Silver", "Golden", "Ashen", "Verdant",
                "Umbral", "Ivory", "Sable", "Azure", "Brazen", "Pale", "Scarlet", "Jade"]
_FACTION_NOUN = ["Hand", "Order", "Covenant", "Syndicate", "Circle", "Blades",
                 "Veil", "Compact", "Lantern", "Key", "Chalice", "Quill",
                 "Standard", "Thorn", "Watch", "Wheel", "Anchor", "Mask"]
_FACTION_SUFFIX = ["of the Dawn", "of Shadows", "of the Nine", "of the Deep",
                   "Unbroken", "Eternal", "of the Last Light", "of the Hollow Hill",
                   "in Exile", "of the Silent Road", "Ascendant", "Reborn"]
_FACTION_RANKS = ["Knights", "Wardens", "Seekers", "Heralds", "Custodians", "Keepers",
                  "Sentinels", "Envoys", "Arbiters", "Pilgrims"]
_FACTION_OF = ["the Open Gate", "the Narrow Path", "Broken Crowns", "the Red Tide",
               "Quiet Steps", "the Unwritten Law", "Fallen Stars", "the Last Coin"]
_FACTION_BROTHERHOOD = ["Brotherhood", "Sisterhood", "Lodges", "Houses", "Choirs", "Gilds"]

_EVENT_NOUN = ["Night", "War", "Siege", "Plague", "Convergence", "Rising", "Fall",
               "Treaty", "Schism", "Harvest", "Winter", "Eclipse", "Famine",
               "Sundering", "Reckoning", "Exodus", "Purification", "Silence"]
_EVENT_ADJ = ["Crimson", "Silent", "Burning", "Shattered", "Golden", "Long",
              "Bitter", "Hollow", "Ashen", "Black", "Quiet", "Red"]
_EVENT_ACT = ["Sundering", "Burning", "Breaking", "Unmaking", "Drowning",
              "Shattering", "Devouring", "Unseating"]
_EVENT_OF = ["the Tower", "the Veil", "Crowns", "the Old Faith", "the Ninth Gate",
               "the River Kings", "the Spine", "Oaths"]
_EVENT_SEASON = ["Ashen", "Weeping", "Silent", "Burning", "Long", "Hungry"]
_EVENT_SEASON_NOUN = ["Winter", "Summer", "Harvest", "Spring", "Frost", "Rain"]
_EVENT_COUNTED = ["Seven", "Nine", "Twelve", "Three", "Hundred"]
_EVENT_DAY = ["Kings", "Ashes", "Knives", "Bells", "Masks", "Embers", "Doors"]

# --- Dedup helper -------------------------------------------------------------


def _unique_batch(build: Callable[[], str], count: int) -> List[str]:
    """Draw ``count`` distinct names, re-rolling collisions up to the bank's
    capacity. If the bank runs dry, fall back to allowing repeats rather than
    looping forever."""
    seen = set()
    out = []
    for _ in range(count):
        name = build()
        for _attempt in range(24):
            if name not in seen:
                break
            name = build()
        seen.add(name)
        out.append(name)
    return out


def _weighted_choice(pairs: List) -> object:
    """Choose from [(value, weight), ...]."""
    total = sum(weight for _, weight in pairs)
    roll = random.uniform(0, total)
    upto = 0.0
    for value, weight in pairs:
        upto += weight
        if roll <= upto:
            return value
    return pairs[-1][0]


# --- Actor names: weighted syllable grammar -----------------------------------


def _actor_name(race: Optional[str]) -> str:
    bank = _RACE_BANKS.get((race or "").lower(), _GENERIC)

    for _attempt in range(12):
        syllables = _weighted_choice(bank["syllables"])
        name = random.choice(bank["onsets"])
        for i in range(syllables):
            # Every syllable after the first opens with a consonant cluster,
            # sometimes fronted by a short vowel interlude (Ael-i-thas) — but
            # never onto a vowel-final prefix, which would stack a vowel run
            # across the boundary (Lae-ie-...).
            if i > 0:
                cluster = random.choice(bank["clusters"])
                if random.random() < 0.3 and name[-1].lower() not in "aeiouy":
                    name += random.choice(bank["interludes"]) + cluster
                else:
                    name += cluster
            # A vowel drawn onto a vowel-final prefix must not extend the run
            # past three (Fae + i = Faei is fine; Fae + ia = Faeia is not).
            vowel = random.choice(bank["vowels"])
            tail = len(re.match(r".*?([aeiouy]*)$", name.lower()).group(1))
            if tail + len(vowel) > 3:
                vowel = vowel[0]
            name += vowel
            # Short names sometimes end on the open vowel (Mara, Doro).
            if i == syllables - 1 and random.random() < 0.12:
                break
            name += random.choice(bank["codas"])
        # Feminine-leaning endings, per-race weight.
        ending = bank["endings"]
        if random.random() < ending["weight"]:
            name += random.choice(ending["pool"])
        if bank["min_len"] <= len(name) <= bank["max_len"]:
            return name
    return name


# --- Place names --------------------------------------------------------------

_PLACE_TEMPLATES = {
    "continent": [
        (lambda: random.choice(_PLACE_PREFIX) + random.choice(_PLACE_GEO["continent"]), 4),
        (lambda: "The " + random.choice(_PLACE_CARDINAL) + " "
                 + random.choice(_PLACE_PREFIX) + random.choice(_PLACE_GEO["continent"]), 1),
    ],
    "kingdom": [
        (lambda: random.choice(_PLACE_PREFIX) + random.choice(_PLACE_GEO["kingdom"]), 5),
        (lambda: "The " + random.choice(_PLACE_PREFIX) + " "
                 + random.choice(_PLACE_GEO["kingdom"]).capitalize(), 2),
        (lambda: random.choice(_PLACE_PERSON) + "'s "
                 + random.choice(_PLACE_GEO["kingdom"]).capitalize(), 1),
    ],
    "city": [
        (lambda: random.choice(_PLACE_PREFIX) + random.choice(_PLACE_GEO["city"]), 5),
        (lambda: random.choice(_PLACE_CARDINAL) + " "
                 + random.choice(_PLACE_PREFIX) + random.choice(_PLACE_GEO["city"]), 2),
        (lambda: random.choice(_PLACE_PREFIX) + "-on-"
                 + random.choice(_PLACE_PREFIX) + random.choice(_PLACE_WATER), 1),
        (lambda: random.choice(_PLACE_PREFIX) + " on the "
                 + random.choice(_PLACE_PREFIX) + random.choice(_PLACE_WATER), 1),
        (lambda: random.choice(_PLACE_PERSON) + "'s "
                 + random.choice(["Crossing", "Rest", "Landing", "Gate", "Folly"]), 1),
    ],
    "town": [
        (lambda: random.choice(_PLACE_PREFIX) + random.choice(_PLACE_GEO["town"]), 5),
        (lambda: random.choice(_PLACE_CARDINAL) + " "
                 + random.choice(_PLACE_PREFIX) + random.choice(_PLACE_GEO["town"]), 2),
        (lambda: random.choice(_PLACE_PREFIX) + "-under-"
                 + random.choice(_PLACE_PREFIX), 1),
        (lambda: random.choice(_PLACE_PERSON) + "'s "
                 + random.choice(["Rest", "Folly", "End", "Hope"]), 1),
    ],
    "building": [
        (lambda: f"The {random.choice(_PLACE_DESCRIPTORS)} {random.choice(_PLACE_NOUNS)}", 6),
        (lambda: "The {} & {}".format(*random.sample(_PLACE_NOUNS, 2)), 2),
        (lambda: f"{random.choice(_PLACE_PERSON)}'s "
                 + random.choice(["Rest", "Respite", "Welcome", "Folly", "Hearth"]), 1),
        (lambda: f"The {random.choice(_PLACE_NOUNS)} in the "
                 + random.choice(["Mist", "Wall", "Stocks", "Shadow", "Rain"]), 1),
    ],
}


def _place_name(level: str) -> str:
    templates = _PLACE_TEMPLATES.get(level, _PLACE_TEMPLATES["city"])
    return _weighted_choice(templates)()


# --- Item names ----------------------------------------------------------------

_ITEM_TEMPLATES = [
    (lambda: f"{random.choice(_ITEM_ADJ)}{random.choice(_ITEM_NOUN)}"
             f" ({random.choice(_ITEM_KIND)})", 5),
    (lambda: f"{random.choice(_ITEM_ADJ)}{random.choice(_ITEM_NOUN)}", 2),
    (lambda: f"{random.choice(_ITEM_NOUN).capitalize()} of "
             f"{random.choice(_ITEM_SLAIN)}", 2),
    (lambda: f"{random.choice(_ITEM_ACT)}, "
             f"{random.choice(_ITEM_KIND)} of "
             f"{random.choice(_ITEM_SLAIN)}", 1),
    (lambda: f"{random.choice(_ITEM_FOLK)} {random.choice(_ITEM_KIND)}", 1),
    (lambda: f"{random.choice(_ITEM_ADJ)}{random.choice(_ITEM_NOUN)}, forged by "
             f"{random.choice(_ITEM_FORGE)}", 1),
]


def _item_name() -> str:
    return _weighted_choice(_ITEM_TEMPLATES)()


# --- Faction names -------------------------------------------------------------

_FACTION_TEMPLATES = [
    (lambda: f"The {random.choice(_FACTION_ADJ)} {random.choice(_FACTION_NOUN)}"
             + (f" {random.choice(_FACTION_SUFFIX)}" if random.random() < 0.4 else ""), 5),
    (lambda: f"{random.choice(_FACTION_RANKS)} of {random.choice(_FACTION_OF)}", 2),
    (lambda: f"The {random.choice(_FACTION_RANKS)} of {random.choice(_FACTION_OF)}", 2),
    (lambda: f"The {random.choice(_FACTION_BROTHERHOOD)} of "
             f"{random.choice(_FACTION_OF)}", 1),
    (lambda: f"The {random.choice(_FACTION_ADJ)} "
             f"{random.choice(_FACTION_BROTHERHOOD)}", 1),
]


def _faction_name() -> str:
    return _weighted_choice(_FACTION_TEMPLATES)()


# --- Event names ----------------------------------------------------------------

_EVENT_TEMPLATES = [
    (lambda: f"The {random.choice(_EVENT_ADJ)} {random.choice(_EVENT_NOUN)}", 3),
    (lambda: f"The {random.choice(_EVENT_NOUN)} of {random.choice(_EVENT_OF)}", 2),
    (lambda: f"The {random.choice(_EVENT_ACT)} of {random.choice(_EVENT_OF)}", 2),
    (lambda: f"The {random.choice(_EVENT_SEASON)} "
             f"{random.choice(_EVENT_SEASON_NOUN)}", 2),
    (lambda: f"The Year of the {random.choice(_EVENT_ADJ)} "
             f"{random.choice(_EVENT_NOUN)}", 1),
    (lambda: f"The {random.choice(_EVENT_COUNTED)} Days' "
             f"{random.choice(_EVENT_NOUN)}", 1),
    (lambda: f"The Day of {random.choice(_EVENT_DAY)}", 1),
]


def _event_name() -> str:
    return _weighted_choice(_EVENT_TEMPLATES)()


# --- Public API -----------------------------------------------------------------

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
        return _unique_batch(lambda: _actor_name(race), count)
    if category == "place":
        level = (place_level or "city").lower()
        if level not in _PLACE_LEVELS:
            raise ValueError(f"Unknown place level: {level}")
        return _unique_batch(lambda: _place_name(level), count)
    if category == "item":
        return _unique_batch(_item_name, count)
    if category == "faction":
        return _unique_batch(_faction_name, count)
    return _unique_batch(_event_name, count)


def list_categories() -> Dict[str, object]:
    """Describe the generator categories for the UI."""
    return {
        "categories": _CATEGORIES,
        "place_levels": _PLACE_LEVELS,
    }
