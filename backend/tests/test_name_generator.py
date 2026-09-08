"""Name generator tests — API contract plus diversity guardrails.

The diversity tests exist because the original generator had one template per
category and a bank small enough that duplicates were guaranteed inside a
single 20-name batch. These assert that the multi-template engines actually
produce varied shapes and that batches stay deduplicated."""

import random
import re

import pytest

from name_generator import generate_names, list_categories

RACES = ["human", "elf", "dwarf", "orc", "gnome", "halfling", "half-elf", "half-orc"]


# --- Contract ------------------------------------------------------------------


def test_categories_and_levels_are_exposed():
    info = list_categories()
    assert set(info["categories"]) == {"actor", "place", "item", "faction", "event"}
    assert set(info["place_levels"]) == {"continent", "kingdom", "city", "town", "building"}


def test_generate_respects_count_cap():
    assert len(generate_names("item", count=100)) == 20


def test_generate_rejects_unknown_category():
    with pytest.raises(ValueError):
        generate_names("nonsense")


def test_generate_rejects_unknown_place_level():
    with pytest.raises(ValueError):
        generate_names("place", place_level="moon")


def test_every_race_generates():
    for race in RACES:
        names = generate_names("actor", count=10, race=race)
        assert len(names) == 10
        assert all(n and n[0].isupper() for n in names)


def test_every_place_level_generates():
    for level in list_categories()["place_levels"]:
        names = generate_names("place", count=10, place_level=level)
        assert len(names) == 10


def test_unknown_race_falls_back_to_generic_bank():
    names = generate_names("actor", count=10, race="kobold")
    assert len(names) == 10


# --- Diversity guardrails -------------------------------------------------------


def test_batch_is_deduplicated():
    """A 20-name batch must not repeat a name while bank capacity allows."""
    for category, kwargs in [
        ("actor", {"race": "human"}),
        ("actor", {"race": "elf"}),
        ("place", {"place_level": "city"}),
        ("place", {"place_level": "building"}),
        ("item", {}),
        ("faction", {}),
        ("event", {}),
    ]:
        names = generate_names(category, count=20, **kwargs)
        assert len(set(names)) == len(names), f"{category}: duplicates in batch {names}"


def _word_shape(name: str) -> str:
    """Reduce a name to its capitalized-word silhouette: 'Stonehaven' -> 'W',
    'The Crimson Veil' -> 'aWW', "Aldric's Rest" -> 'aW'."""
    return "".join("W" if word[0].isupper() else "a" for word in name.split() if word)


def test_output_shapes_vary_within_category():
    """Each multi-template category must produce more than one distinct word
    shape over a large sample — the failure mode this guards against is every
    output following one construction pattern. Thresholds are calibrated per
    category: town's possessive and compound templates both render as two-word
    shapes, so its honest ceiling is two."""
    random.seed(42)  # deterministic: a shape count this low cannot be flaky luck
    minimum_shapes = {
        ("place", "city"): 3,
        ("place", "town"): 2,
        ("place", "building"): 3,
        ("item", None): 3,
        ("faction", None): 3,
        ("event", None): 3,
    }
    for (category, level), minimum in minimum_shapes.items():
        kwargs = {"place_level": level} if level else {}
        # Bypass the per-batch cap by drawing one name per call.
        shapes = {
            _word_shape(generate_names(category, count=1, **kwargs)[0])
            for _ in range(500)
        }
        assert len(shapes) >= minimum, f"{category}/{level}: only shapes {shapes}"


def test_actor_names_are_distinct_in_large_samples():
    random.seed(42)
    names = [generate_names("actor", count=1, race="elf")[0] for _ in range(400)]
    assert len(set(names)) >= 350, f"only {len(set(names))} distinct elf names in 400 draws"


def test_actor_names_stay_pronounceable():
    """No vowel runs longer than three, no consonant runs longer than four —
    the slot-machine failure mode was names like 'Thedisonibert' with no sense
    of the language's sound."""
    random.seed(42)
    for race in RACES:
        for name in generate_names("actor", count=20, race=race):
            assert not re.search(r"[aeiouy]{4,}", name.lower()), name
            assert not re.search(r"[bcdfghjklmnpqrstvwxz]{5,}", name.lower()), name
