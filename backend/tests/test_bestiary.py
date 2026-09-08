"""Bestiary library tests against a small synthetic fixture CSV.

The real bestiary is user-supplied game content and is never committed, so
these fixtures are invented rows exercising the parser's quirks: repr literals,
blank-ability constructs, misspelled columns, and malformed data.
"""

import csv
import json

import pytest

import main
from bestiary import BestiaryLibrary, parse_bestiary_row
from rules.common import build_pathfinder_1e_monster_sheet, map_bestiary_entry_to_actor


FIXTURE_COLUMNS = [
    "Monster", "CR", "type", "URL",
    "AC/AC", "AC/touch", "AC/flat_footed",
    "HP/HP", "HP/HD", "HP/fast_healing",
    "saves/fort", "saves/ref", "saves/will", "saves/other",
    "ability_scores/STR", "ability_scores/DEX", "ability_scores/CON",
    "ability_scores/INT", "ability_scores/WIS", "ability_scores/CHA",
    "BAB", "CMB", "CMD", "SR", "XP", "size", "alignment",
    "initiative/bonus",
    "attacks/melee_1", "attacks/ranged_1", "attacks/special",
    "skills/Perception", "skills/Knowledge (naturel)", "resistances/electricty",
    "feats", "immunities", "speeds/base", "speeds/fly",
    "senses/darkvision", "special_abilities", "ecology/environment",
    "desc_short", "desc_long", "sources_1/name", "sources_1/page",
    "DR_1/amount", "DR_1/weakness", "is_3.5", "ecology/advancement_3.5_1/HD_min",
]

FIXTURE_ROWS = [
    {
        "Monster": "Test Goblin", "CR": "0.5", "type": "humanoid",
        "URL": "https://example.invalid/goblin",
        "AC/AC": "16", "AC/touch": "13", "AC/flat_footed": "14",
        "HP/HP": "6", "HP/HD": "1d10+1", "HP/fast_healing": "",
        "saves/fort": "3", "saves/ref": "2", "saves/will": "-1", "saves/other": "",
        "ability_scores/STR": "11", "ability_scores/DEX": "15", "ability_scores/CON": "12",
        "ability_scores/INT": "10", "ability_scores/WIS": "9", "ability_scores/CHA": "6",
        "BAB": "1", "CMB": "0", "CMD": "13", "SR": "", "XP": "200",
        "size": "Small", "alignment": "NE", "initiative/bonus": "6",
        "attacks/melee_1": "[{'text': 'short sword +2 (1d4/19-20)', 'attack': 'short sword', 'bonus': [2]}]",
        "attacks/ranged_1": "",
        "attacks/special": "['sneak attack +1d6']",
        "skills/Perception": "5", "skills/Knowledge (naturel)": "4",
        "resistances/electricty": "10",
        "feats": "Improved Initiative, Weapon Finesse",
        "immunities": "", "speeds/base": "30", "speeds/fly": "",
        "senses/darkvision": "60",
        "special_abilities": "['Goblin Fury (Ex): A test goblin is very angry.']",
        "ecology/environment": "temperate forests",
        "desc_short": "This goblin snarls testily.",
        "desc_long": "A long test description of a goblin.",
        "sources_1/name": "Test Bestiary", "sources_1/page": "99",
        "DR_1/amount": "", "DR_1/weakness": "",
        "is_3.5": "", "ecology/advancement_3.5_1/HD_min": "",
    },
    {
        "Monster": "Test Construct", "CR": "7", "type": "construct",
        "URL": "",
        "AC/AC": "20", "AC/touch": "9", "AC/flat_footed": "20",
        "HP/HP": "60", "HP/HD": "8d10+20", "HP/fast_healing": "",
        "saves/fort": "2", "saves/ref": "2", "saves/will": "4", "saves/other": "",
        "ability_scores/STR": "22", "ability_scores/DEX": "9", "ability_scores/CON": "",
        "ability_scores/INT": "", "ability_scores/WIS": "11", "ability_scores/CHA": "1",
        "BAB": "8", "CMB": "14", "CMD": "23", "SR": "18", "XP": "3200",
        "size": "Large", "alignment": "N", "initiative/bonus": "-1",
        "attacks/melee_1": "[{'text': '2 slams +14 (2d6+7)', 'attack': 'slams', 'bonus': [14], 'count': 2}]",
        "attacks/ranged_1": "",
        "attacks/special": "",
        "skills/Perception": "", "skills/Knowledge (naturel)": "",
        "resistances/electricty": "",
        "feats": "",
        "immunities": "construct traits", "speeds/base": "20", "speeds/fly": "",
        "senses/darkvision": "60",
        "special_abilities": "",
        "ecology/environment": "any",
        "desc_short": "A test automaton.",
        "desc_long": "A long test description of a construct.",
        "sources_1/name": "Test Bestiary", "sources_1/page": "100",
        "DR_1/amount": "5", "DR_1/weakness": "adamantine",
        "is_3.5": "", "ecology/advancement_3.5_1/HD_min": "",
    },
]


def write_fixture_csv(path, rows=FIXTURE_ROWS):
    with path.open("w", newline="", encoding="utf-8") as fixture_file:
        writer = csv.DictWriter(fixture_file, fieldnames=FIXTURE_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def make_library(tmp_path, rows=FIXTURE_ROWS):
    library = BestiaryLibrary(tmp_path / "reference_library")
    source_dir = library.root_dir / "sources" / "pathfinder_1e"
    source_dir.mkdir(parents=True)
    write_fixture_csv(source_dir / "bestiary.csv", rows)
    return library


def test_import_indexes_monsters_and_status_reports_counts(tmp_path):
    library = make_library(tmp_path)

    result = library.import_source("1e", "pathfinder_1e")

    assert result["entry_count"] == 2
    assert result["filename"] == "bestiary.csv"
    assert result["warnings"] == []

    status = library.status("1e", "pathfinder_1e")
    assert status["source_present"] is True
    assert status["imported"] is True
    assert status["entry_count"] == 2
    assert status["stale"] is False


def test_status_before_and_without_source(tmp_path):
    library = BestiaryLibrary(tmp_path / "reference_library")
    status = library.status("1e", "pathfinder_1e")
    assert status["source_present"] is False
    assert status["imported"] is False
    assert status["entry_count"] == 0


def test_import_without_csv_raises_file_not_found(tmp_path):
    library = BestiaryLibrary(tmp_path / "reference_library")
    (library.root_dir / "sources" / "pathfinder_1e").mkdir(parents=True)
    with pytest.raises(FileNotFoundError):
        library.import_source("1e", "pathfinder_1e")


def test_search_filters_by_query_cr_and_type(tmp_path):
    library = make_library(tmp_path)
    library.import_source("1e", "pathfinder_1e")

    goblins = library.search("1e", "goblin")
    assert [g["name"] for g in goblins] == ["Test Goblin"]

    low_cr = library.search("1e", "", cr_max=1)
    assert [g["name"] for g in low_cr] == ["Test Goblin"]

    constructs = library.search("1e", "", monster_type="construct")
    assert [c["name"] for c in constructs] == ["Test Construct"]

    everything = library.search("1e", "")
    assert len(everything) == 2
    assert {e["cr_display"] for e in everything} == {"0.5", "7"}


def test_search_without_index_returns_empty(tmp_path):
    library = BestiaryLibrary(tmp_path / "reference_library")
    assert library.search("1e", "goblin") == []


def test_get_entry_returns_full_record_and_404_case(tmp_path):
    library = make_library(tmp_path)
    library.import_source("1e", "pathfinder_1e")

    entry = library.get_entry("1e", 1)
    assert entry["name"] == "Test Goblin"
    assert entry["attacks"][0]["name"] == "short sword"
    assert entry["attacks"][0]["text"].startswith("short sword +2")
    # Misspelled source columns fold onto canonical names.
    assert any(skill["name"] == "Knowledge (nature)" for skill in entry["skills"])
    assert entry["resistances"].get("electricity") == 10
    # 3.5-legacy columns are dropped.
    assert "is_3.5" not in json.dumps(entry)
    assert entry["sources"] == [{"name": "Test Bestiary", "page": "99", "link": ""}]

    assert library.get_entry("1e", 999) is None


def test_blank_ability_scores_stay_absent(tmp_path):
    library = make_library(tmp_path)
    library.import_source("1e", "pathfinder_1e")

    construct = library.get_entry("1e", 2)
    assert construct["abilities"]["con"] is None
    assert construct["abilities"]["str"] == 22


def test_malformed_literal_is_a_warning_not_a_failure(tmp_path):
    row = dict(FIXTURE_ROWS[0])
    row["attacks/melee_1"] = "[{'text': 'broken"

    record, warnings = parse_bestiary_row(row, row_number=2)

    assert record is not None
    assert record["name"] == "Test Goblin"
    assert record["attacks"][0]["name"] == ""  # raw text kept, not parsed
    assert "broken" in record["attacks"][0]["text"]
    assert any("unparsable literal" in warning for warning in warnings)


def test_repr_looking_text_column_warns_without_double_warning(tmp_path):
    """A truncated repr in a verbatim-copied column warns once, not zero or twice."""
    row = dict(FIXTURE_ROWS[0])
    row["AC/other"] = "(+4 armor, +4 Dex,"  # truncated upstream export

    record, warnings = parse_bestiary_row(row, row_number=2)

    assert record is not None
    assert record["ac"]["other"] == "(+4 armor, +4 Dex,"
    hits = [w for w in warnings if "repr-looking value does not parse" in w]
    assert len(hits) == 1
    assert "AC/other" in hits[0]

    # Columns already literal-parsed elsewhere must not double-warn.
    row2 = dict(FIXTURE_ROWS[0])
    row2["attacks/melee_1"] = "[{'broken'"
    _, warnings2 = parse_bestiary_row(row2, row_number=2)
    assert not any("repr-looking value does not parse" in w for w in warnings2)


def test_row_without_name_is_skipped_with_warning(tmp_path):
    row = dict(FIXTURE_ROWS[0])
    row["Monster"] = ""

    record, warnings = parse_bestiary_row(row, row_number=2)

    assert record is None
    assert any("missing Monster name" in warning for warning in warnings)


def test_import_survives_malformed_rows_and_reports_warnings(tmp_path):
    rows = [dict(FIXTURE_ROWS[0]), dict(FIXTURE_ROWS[1], **{"attacks/special": "[{'oops'"})]
    library = make_library(tmp_path, rows)

    result = library.import_source("1e", "pathfinder_1e")

    assert result["entry_count"] == 2
    assert any("unparsable literal" in warning for warning in result["warnings"])


def test_reimport_replaces_rows_and_resets_ids(tmp_path):
    library = make_library(tmp_path)
    library.import_source("1e", "pathfinder_1e")
    library.import_source("1e", "pathfinder_1e")

    assert library.status("1e", "pathfinder_1e")["entry_count"] == 2
    assert library.get_entry("1e", 1)["name"] == "Test Goblin"
    assert library.get_entry("1e", 3) is None


def test_ruleset_isolation(tmp_path):
    library = make_library(tmp_path)
    library.import_source("1e", "pathfinder_1e")

    assert library.search("2e", "goblin") == []
    assert library.get_entry("2e", 1) is None


def test_monster_sheet_shares_tracker_contract_keys():
    sheet_definition = build_pathfinder_1e_monster_sheet()
    assert [field["value_key"] for field in sheet_definition["summary"]] == [
        "hp.current", "defenses.ac", "initiative.bonus",
    ]
    assert sheet_definition["player_resource"]["current_key"] == "hp.current"
    assert sheet_definition["initiative"]["bonus_key"] == "initiative.bonus"


def test_mapper_builds_npc_actor_from_entry(tmp_path):
    library = make_library(tmp_path)
    library.import_source("1e", "pathfinder_1e")
    entry = library.get_entry("1e", 1)

    actor = map_bestiary_entry_to_actor(entry)

    assert actor["name"] == "Test Goblin"
    assert actor["is_pc"] is False
    sheet = actor["sheet"]
    assert sheet["hp"]["current"] == 6 and sheet["hp"]["max"] == 6
    assert sheet["defenses"]["ac"] == 16
    assert sheet["initiative"]["bonus"] == 6
    assert sheet["monster"]["cr"] == "0.5"
    assert sheet["attacks"][0]["text"] == "short sword +2 (1d4/19-20)"
    assert sheet["skills"][0]["name"].startswith("Knowledge")
    assert "Test Bestiary p. 99" in sheet["bestiary"]["source"]
    assert json.loads(actor["notes"])["bestiary_entry_id"] == 1


def test_mapper_renders_blank_abilities_as_dashes(tmp_path):
    library = make_library(tmp_path)
    library.import_source("1e", "pathfinder_1e")
    entry = library.get_entry("1e", 2)

    actor = map_bestiary_entry_to_actor(entry)

    assert actor["sheet"]["abilities"]["con"] == "—"
    assert actor["sheet"]["abilities"]["str"] == "22"
    assert actor["sheet"]["defenses"]["dr"] == "5/adamantine"


def test_bestiary_routes_roundtrip(client, tmp_path):
    """Full HTTP loop: status → import → search → entry → actor mapping."""
    library = make_library(tmp_path)
    main.bestiary_library = library

    client.post("/api/campaign/new", params={"name": "route-test", "ruleset": "1e"})

    status = client.get("/api/bestiary/current/status").json()
    assert status["source_present"] is True
    assert status["imported"] is False

    imported = client.post("/api/bestiary/current/import").json()
    assert imported["entry_count"] == 2

    results = client.get("/api/bestiary/current/search", params={"query": "goblin"}).json()["results"]
    assert [r["name"] for r in results] == ["Test Goblin"]

    entry_id = results[0]["id"]
    entry = client.get(f"/api/bestiary/current/entry/{entry_id}").json()
    assert entry["name"] == "Test Goblin"

    actor = client.get(f"/api/bestiary/current/entry/{entry_id}/actor").json()
    assert actor["is_pc"] is False
    assert actor["sheet"]["defenses"]["ac"] == 16

    assert client.get("/api/bestiary/current/entry/999").status_code == 404


def test_actor_mapping_route_404s_without_mapper(client, tmp_path):
    """2e has no bestiary mapper; the route must say so rather than 500."""
    library = make_library(tmp_path)
    main.bestiary_library = library

    client.post("/api/campaign/new", params={"name": "route-test-2e", "ruleset": "2e"})
    response = client.get("/api/bestiary/current/entry/1/actor")
    assert response.status_code == 404
    assert "no bestiary mapping" in response.json()["detail"]
