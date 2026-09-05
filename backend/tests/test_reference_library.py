from reference_library import ReferenceLibrary


def test_indexes_and_searches_page_aware_local_reference(tmp_path):
    library = ReferenceLibrary(tmp_path / "reference_library")
    library.index_pages(
        "1e",
        "core_rulebook.pdf",
        "Core Rulebook",
        ["Combat begins with initiative.\n\nArmor Class determines whether an attack hits.", "Spells use a saving throw."],
    )

    results = library.search("1e", "armor class")

    assert len(results) == 1
    assert results[0]["title"] == "Core Rulebook"
    assert results[0]["filename"] == "core_rulebook.pdf"
    assert results[0]["page_number"] == 1
    assert "Armor Class determines" in results[0]["excerpt"]


def test_search_ignores_empty_queries_and_unindexed_rulesets(tmp_path):
    library = ReferenceLibrary(tmp_path / "reference_library")

    assert library.search("1e", "") == []
    assert library.search("2e", "initiative") == []


def test_discovers_sources_in_the_configured_ruleset_directory(tmp_path):
    library = ReferenceLibrary(tmp_path / "reference_library")
    source_dir = library.root_dir / "sources" / "pathfinder_1e"
    source_dir.mkdir(parents=True)
    (source_dir / "core_rulebook.pdf").touch()

    assert library.available_sources("1e", "pathfinder_1e") == ["core_rulebook.pdf"]