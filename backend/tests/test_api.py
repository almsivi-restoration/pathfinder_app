"""API-level regression tests, exercised through FastAPI's TestClient against the real routes
in main.py. These catch wiring bugs (mismatched params, forgotten arguments) that unit tests
against StateManager alone would not - each test uses an isolated client fixture (conftest.py).
"""


def actor_payload(name="Goblin", is_pc=False):
    return {
        "id": "",
        "name": name,
        "player_name": None,
        "is_pc": is_pc,
        "initiative_roll": None,
        "effects": [],
        "notes": "",
        "sheet": {"hp": {"current": 10, "max": 10}},
    }


def test_actor_color_roundtrips_and_legacy_actors_default_to_none(client):
    client.post("/api/campaign/new", params={"name": "Colors", "ruleset": "1e"})
    client.post("/api/scene/new", params={"name": "Grid"})

    # Payload without the color key (pre-color campaigns) loads as None.
    res = client.post("/api/actor/add", json=actor_payload())
    assert res.status_code == 200
    assert res.json()["color"] is None
    actor_id = res.json()["id"]

    # Assigning a color persists through update and re-read.
    actor = client.get(f"/api/actor/{actor_id}").json()
    actor["color"] = "#8e44ad"
    res = client.put(f"/api/actor/{actor_id}", json=actor)
    assert res.status_code == 200
    assert res.json()["color"] == "#8e44ad"
    assert client.get(f"/api/actor/{actor_id}").json()["color"] == "#8e44ad"

    # Cloning (a payload copy with a blank id) preserves the color but earns a new id.
    clone = {**actor, "id": "", "effects": [], "initiative_roll": None}
    res = client.post("/api/actor/add", json=clone)
    assert res.status_code == 200
    assert res.json()["color"] == "#8e44ad"
    assert res.json()["id"] != actor_id

    # Clearing the color returns to None.
    actor["color"] = None
    res = client.put(f"/api/actor/{actor_id}", json=actor)
    assert res.json()["color"] is None


def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    # Version identifies the backend to the desktop shell; "unknown" when the
    # shell (which sets GM_WORKBENCH_VERSION) is not driving.
    assert "version" in body


def test_campaign_rulesets_come_from_the_registry(client):
    res = client.get("/api/rulesets")
    assert res.status_code == 200
    assert {"id": "1e", "name": "Pathfinder 1e"} in res.json()["rulesets"]

    res = client.post("/api/campaign/new", params={"name": "Invalid", "ruleset": "unknown"})
    assert res.status_code == 400


def test_rename_campaign_roundtrips_with_saved_scenes(client):
    client.post("/api/campaign/new", params={"name": "Before", "ruleset": "1e"})
    scene = client.post("/api/scene/new", params={"name": "Ambush"}).json()
    client.post("/api/scene/save")
    client.post("/api/campaign/save")

    response = client.post("/api/campaign/rename", params={"name": "Before", "new_name": " After "})

    assert response.status_code == 200
    assert response.json()["name"] == "After"
    assert client.get("/api/campaign/current").json()["name"] == "After"
    assert client.get("/api/scene/current").json()["id"] == scene["id"]
    assert client.get("/api/campaign/list").json() == {"campaigns": ["After"]}
    assert client.post("/api/campaign/load", params={"name": "Before"}).status_code == 404
    assert client.post("/api/campaign/load", params={"name": "After"}).status_code == 200
    assert client.get("/api/scenes").json()["scenes"][0]["id"] == scene["id"]


def test_rename_campaign_reports_missing_invalid_and_duplicate_names(client):
    client.post("/api/campaign/new", params={"name": "Before", "ruleset": "1e"})
    client.post("/api/campaign/new", params={"name": "Keep", "ruleset": "2e"})

    assert client.post("/api/campaign/rename", params={"name": "Missing", "new_name": "After"}).status_code == 404
    for new_name in [" ", "../Escape", "Keep"]:
        response = client.post("/api/campaign/rename", params={"name": "Before", "new_name": new_name})
        assert response.status_code == 400
        assert response.json()["detail"]
    assert set(client.get("/api/campaign/list").json()["campaigns"]) == {"Before", "Keep"}


def test_export_import_campaign_roundtrips_scenes_templates_and_chronicle(client):
    client.post("/api/campaign/new", params={"name": "Origin", "ruleset": "2e"})
    scene = client.post("/api/scene/new", params={"name": "Ambush"}).json()
    client.post("/api/actor/add", json=actor_payload("Bandit"))
    client.post("/api/scene/save")
    client.post("/api/campaign/actor-template/add", json=actor_payload("Hero", is_pc=True))
    client.post("/api/campaign/chronicle/add", json={"title": "Session 1", "body": "We met."})
    client.post("/api/campaign/save")

    response = client.get("/api/campaign/export", params={"name": "Origin"})
    assert response.status_code == 200
    bundle = response.json()
    assert bundle["format"] == "gm-workbench-campaign"
    assert bundle["version"] == 1
    assert [s["id"] for s in bundle["scenes"]] == [scene["id"]]

    response = client.post("/api/campaign/import", json=bundle)
    assert response.status_code == 200
    assert response.json()["name"] == "Origin (imported)"
    assert client.post("/api/campaign/import", json=bundle).json()["name"] == "Origin (imported 2)"
    assert set(client.get("/api/campaign/list").json()["campaigns"]) == {
        "Origin", "Origin (imported)", "Origin (imported 2)",
    }

    loaded = client.post("/api/campaign/load", params={"name": "Origin (imported)"}).json()
    assert loaded["ruleset"] == "2e"
    assert [t["name"] for t in loaded["actor_templates"]] == ["Hero"]
    assert [e["title"] for e in loaded["chronicle"]] == ["Session 1"]
    scenes = client.get("/api/scenes").json()["scenes"]
    assert [s["id"] for s in scenes] == [scene["id"]]
    assert [a["name"] for a in scenes[0]["actors"]] == ["Bandit"]


def test_import_campaign_rejects_foreign_newer_and_unsafe_bundles(client):
    client.post("/api/campaign/new", params={"name": "Origin", "ruleset": "1e"})
    client.post("/api/campaign/save")
    bundle = client.get("/api/campaign/export", params={"name": "Origin"}).json()

    assert client.get("/api/campaign/export", params={"name": "Missing"}).status_code == 404
    assert client.get("/api/campaign/export", params={"name": ".."}).status_code == 404
    bad_bundles = [
        {"campaign": bundle["campaign"]},
        {**bundle, "version": 99},
        {**bundle, "campaign": {"name": "No Ruleset"}},
        {**bundle, "campaign": {**bundle["campaign"], "ruleset": "unknown"}},
        {**bundle, "campaign": {**bundle["campaign"], "name": "../Escape"}},
        {**bundle, "scenes": [{"id": "../escape", "name": "Bad"}]},
    ]
    for bad_bundle in bad_bundles:
        response = client.post("/api/campaign/import", json=bad_bundle)
        assert response.status_code == 400, bad_bundle
        assert response.json()["detail"]
    assert client.get("/api/campaign/list").json() == {"campaigns": ["Origin"]}


def test_delete_campaign_removes_the_saved_campaign(client):
    client.post("/api/campaign/new", params={"name": "Disposable", "ruleset": "1e"})

    response = client.delete("/api/campaign/Disposable")

    assert response.status_code == 200
    assert client.get("/api/campaign/list").json() == {"campaigns": []}


def test_campaign_scene_actor_happy_path(client):
    res = client.post("/api/campaign/new", params={"name": "Test Camp", "ruleset": "1e"})
    assert res.status_code == 200
    assert res.json()["name"] == "Test Camp"

    res = client.post("/api/scene/new", params={"name": "Ambush"})
    assert res.status_code == 200
    assert res.json()["actors"] == []
    scene_id = res.json()["id"]

    res = client.post("/api/scene/save")
    assert res.status_code == 200
    res = client.get("/api/scenes")
    assert [scene["id"] for scene in res.json()["scenes"]] == [scene_id]

    res = client.post("/api/actor/add", json=actor_payload())
    assert res.status_code == 200
    actor_id = res.json()["id"]
    assert actor_id  # server assigned a real id, not the empty string we sent

    res = client.get(f"/api/actor/{actor_id}")
    assert res.status_code == 200
    assert res.json()["name"] == "Goblin"

    res = client.post("/api/initiative/set", json={"actor_ids": [actor_id]})
    assert res.status_code == 200
    assert res.json()["initiative_order"] == [actor_id]
    assert res.json()["round"] == 1

    res = client.delete(f"/api/actor/{actor_id}")
    assert res.status_code == 200

    res = client.get(f"/api/actor/{actor_id}")
    assert res.status_code == 404

    res = client.delete(f"/api/actor/{actor_id}")
    assert res.status_code == 404

    res = client.post("/api/scene/close")
    assert res.status_code == 200
    res = client.post("/api/scene/load", params={"scene_id": scene_id})
    assert res.status_code == 200
    res = client.delete(f"/api/scene/{scene_id}")
    assert res.status_code == 200


def test_actor_not_found_returns_404(client):
    client.post("/api/campaign/new", params={"name": "Camp2", "ruleset": "1e"})
    client.post("/api/scene/new", params={"name": "Fight"})
    res = client.get("/api/actor/does-not-exist")
    assert res.status_code == 404


def test_ruleset_config_endpoint(client):
    res = client.get("/api/rules/current")
    assert res.status_code == 404

    client.post("/api/campaign/new", params={"name": "Rules Camp", "ruleset": "1e"})
    res = client.get("/api/rules/current")
    assert res.status_code == 200
    body = res.json()
    assert "saves" in body and "skills" in body
    assert "fort" in body["saves"]
    assert body["actor_sheet"]["player_resource"]["current_key"] == "hp.current"
    assert any(field["key"] == "weapons" for field in body["actor_sheet"]["fields"])


def test_pathfinder_2e_ruleset_exposes_its_own_character_sheet(client):
    client.post("/api/campaign/new", params={"name": "2e Rules Camp", "ruleset": "2e"})

    response = client.get("/api/rules/current")

    assert response.status_code == 200
    fields = response.json()["actor_sheet"]["fields"]
    assert any(field["key"] == "character.hero_points" for field in fields)
    assert any(field["key"] == "strikes" for field in fields)
    assert any(field["key"] == "focus_spells" for field in fields)


def test_numenera_ruleset_exposes_its_own_character_sheet(client):
    client.post("/api/campaign/new", params={"name": "Numenera Rules Camp", "ruleset": "numenera"})

    response = client.get("/api/rules/current")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Numenera"
    assert body["reference_directory"] == "numenera"
    assert body["abilities"] == ["might", "speed", "intellect"]
    assert body["saves"] == []
    assert body["max_level"] == 6

    sheet = body["actor_sheet"]
    fields = sheet["fields"]
    keys = {field["key"] for field in fields}
    # Shared tracker contract: the Might pool stands in for HP, Armor for AC.
    assert {"hp.current", "hp.max", "defenses.ac", "initiative.bonus"} <= keys
    assert {"pools.speed.current", "pools.intellect.current", "character.tier", "cyphers"} <= keys
    assert sheet["player_resource"] == {"label": "Might Pool", "current_key": "hp.current", "max_key": "hp.max"}

    creature_fields = {field["key"] for field in body["monster_sheet"]["fields"]}
    assert {"hp.current", "hp.max", "defenses.ac", "initiative.bonus", "creature.level"} <= creature_fields


def test_reference_routes_require_and_scope_to_the_current_campaign(client, tmp_path):
    import main
    from reference_library import ReferenceLibrary

    main.reference_library = ReferenceLibrary(tmp_path / "reference_library")
    assert client.get("/api/references/current").status_code == 404

    client.post("/api/campaign/new", params={"name": "Rules Camp", "ruleset": "1e"})
    response = client.get("/api/references/current")

    assert response.status_code == 200
    assert response.json() == {
        "ruleset": "1e",
        "source_files": [],
        "documents": [],
        "ocr_available": main.reference_library.ocr_available(),
    }

    assert client.get("/api/references/current/files/../campaign.json").status_code == 404

    source_dir = main.reference_library.root_dir / "sources" / "pathfinder_1e"
    source_dir.mkdir(parents=True)
    (source_dir / "core_rulebook.pdf").write_bytes(b"%PDF-1.4 test document")
    response = client.get("/api/references/current/files/core_rulebook.pdf")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content == b"%PDF-1.4 test document"


def test_sheet_import_requires_campaign_and_1e(client):
    import main

    # No campaign loaded -> 404.
    res = client.post("/api/import/sheet", files={"file": ("sheet.pdf", b"%PDF-1.4", "application/pdf")})
    assert res.status_code == 404

    # 2e campaign -> 400 (1e only for now).
    client.post("/api/campaign/new", params={"name": "TwoE", "ruleset": "2e"})
    res = client.post("/api/import/sheet", files={"file": ("sheet.pdf", b"%PDF-1.4", "application/pdf")})
    assert res.status_code == 400

    # 1e campaign but OCR engine unavailable -> 503 with structured guidance.
    client.post("/api/campaign/new", params={"name": "OneE", "ruleset": "1e"})
    main.sheet_importer = type("Stub", (), {
        "ocr_available": staticmethod(lambda: False),
        "ocr_install_guidance": staticmethod(lambda: {"message": "no OCR", "venv_dir": "/x", "commands": ["c1", "c2"]}),
    })()
    res = client.post("/api/import/sheet", files={"file": ("sheet.pdf", b"%PDF-1.4", "application/pdf")})
    assert res.status_code == 503
    assert res.json()["detail"]["commands"] == ["c1", "c2"]


def test_roll_dice_respects_die_type_and_modifier(client):
    res = client.post("/api/roll", json={"die_type": 20, "modifier": 5, "bonus_dice": 0})
    assert res.status_code == 200
    body = res.json()
    assert 1 <= body["die_roll"] <= 20
    assert body["total"] == body["die_roll"] + 5


def test_actor_template_endpoints(client):
    client.post("/api/campaign/new", params={"name": "Camp3", "ruleset": "1e"})
    client.post("/api/scene/new", params={"name": "Fight"})

    res = client.post("/api/campaign/actor-template/add", json=actor_payload(name="Orc"))
    assert res.status_code == 200
    template_id = res.json()["id"]

    res = client.get("/api/campaign/actor-templates")
    assert res.status_code == 200
    assert len(res.json()["templates"]) == 1

    updated_payload = actor_payload(name="Orc Chieftain")
    updated_payload["id"] = template_id
    res = client.put(f"/api/campaign/actor-template/{template_id}", json=updated_payload)
    assert res.status_code == 200
    assert res.json()["name"] == "Orc Chieftain"

    res = client.post(f"/api/scene/actor/from-template/{template_id}")
    assert res.status_code == 200
    assert res.json()["id"] != template_id

    res = client.delete(f"/api/campaign/actor-template/{template_id}")
    assert res.status_code == 200
