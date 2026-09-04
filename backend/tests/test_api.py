"""API-level regression tests, exercised through FastAPI's TestClient against the real routes
in main.py. These catch wiring bugs (mismatched params, forgotten arguments) that unit tests
against StateManager alone would not - each test uses an isolated client fixture (conftest.py).
"""


def actor_payload(name="Goblin", is_pc=False):
    return {
        "id": "",
        "name": name,
        "player_name": None,
        "ruleset": "1e",
        "is_pc": is_pc,
        "hp_current": 10,
        "hp_max": 10,
        "ac": 12,
        "initiative_bonus": 2,
        "initiative_roll": None,
        "speed": 30,
        "abilities": {"str": 10, "dex": 12, "con": 10, "int": 10, "wis": 10, "cha": 10},
        "skills": {},
        "saves": {},
        "resistances": {},
        "weapons": [],
        "effects": [],
        "notes": "",
    }


def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_campaign_encounter_actor_happy_path(client):
    res = client.post("/api/campaign/new", params={"name": "Test Camp", "ruleset": "1e"})
    assert res.status_code == 200
    assert res.json()["name"] == "Test Camp"

    res = client.post("/api/encounter/new", params={"name": "Ambush", "ruleset": "1e"})
    assert res.status_code == 200
    assert res.json()["actors"] == []

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


def test_actor_not_found_returns_404(client):
    client.post("/api/campaign/new", params={"name": "Camp2", "ruleset": "1e"})
    client.post("/api/encounter/new", params={"name": "Fight", "ruleset": "1e"})
    res = client.get("/api/actor/does-not-exist")
    assert res.status_code == 404


def test_ruleset_config_endpoint(client):
    res = client.get("/api/rules/1e")
    assert res.status_code == 200
    body = res.json()
    assert "saves" in body and "skills" in body
    assert "fort" in body["saves"]

    res = client.get("/api/rules/not-a-real-ruleset")
    assert res.status_code == 404


def test_roll_dice_respects_die_type_and_modifier(client):
    res = client.post("/api/roll", json={"die_type": 20, "modifier": 5, "bonus_dice": 0})
    assert res.status_code == 200
    body = res.json()
    assert 1 <= body["die_roll"] <= 20
    assert body["total"] == body["die_roll"] + 5


def test_actor_template_endpoints(client):
    client.post("/api/campaign/new", params={"name": "Camp3", "ruleset": "1e"})
    client.post("/api/encounter/new", params={"name": "Fight", "ruleset": "1e"})

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

    res = client.post(f"/api/encounter/actor/from-template/{template_id}")
    assert res.status_code == 200
    assert res.json()["id"] != template_id

    res = client.delete(f"/api/campaign/actor-template/{template_id}")
    assert res.status_code == 200
