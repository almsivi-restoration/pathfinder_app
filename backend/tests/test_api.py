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
