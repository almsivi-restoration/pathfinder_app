"""Chronicle (campaign journal) tests — routes through the isolated `client`
fixture, persistence verified by reloading the campaign from its tmp_path dir."""


def create_campaign(client, name="test0", ruleset="1e"):
    response = client.post("/api/campaign/new", params={"name": name, "ruleset": ruleset})
    assert response.status_code == 200
    return response


def add_entry(client, title="Session One", body="The party **met** at the inn."):
    return client.post("/api/campaign/chronicle/add", json={"title": title, "body": body})


def test_add_and_list_entries(client):
    create_campaign(client)

    added = add_entry(client)
    assert added.status_code == 200
    entry = added.json()
    assert entry["id"]
    assert entry["title"] == "Session One"
    assert entry["body"] == "The party **met** at the inn."
    assert entry["created_at"]
    assert entry["updated_at"]

    listed = client.get("/api/campaign/chronicle")
    assert listed.status_code == 200
    entries = listed.json()["entries"]
    assert len(entries) == 1
    assert entries[0]["id"] == entry["id"]


def test_add_entry_requires_campaign(client):
    response = add_entry(client)
    assert response.status_code == 400


def test_add_entry_requires_title(client):
    create_campaign(client)
    response = add_entry(client, title="   ")
    assert response.status_code == 400


def test_update_entry(client):
    create_campaign(client)
    entry_id = add_entry(client).json()["id"]

    updated = client.put(
        f"/api/campaign/chronicle/{entry_id}",
        json={"title": "Session One (Revised)", "body": "> A quote now."},
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Session One (Revised)"
    assert updated.json()["body"] == "> A quote now."

    entries = client.get("/api/campaign/chronicle").json()["entries"]
    assert entries[0]["title"] == "Session One (Revised)"


def test_update_missing_entry_returns_404(client):
    create_campaign(client)
    response = client.put(
        "/api/campaign/chronicle/no-such-id",
        json={"title": "Nope", "body": ""},
    )
    assert response.status_code == 404


def test_delete_entry(client):
    create_campaign(client)
    entry_id = add_entry(client).json()["id"]

    deleted = client.delete(f"/api/campaign/chronicle/{entry_id}")
    assert deleted.status_code == 200
    assert client.get("/api/campaign/chronicle").json()["entries"] == []

    assert client.delete(f"/api/campaign/chronicle/{entry_id}").status_code == 404


def test_entries_persist_across_campaign_reload(client):
    create_campaign(client)
    add_entry(client, title="First")
    add_entry(client, title="Second", body="*later*")

    loaded = client.post("/api/campaign/load", params={"name": "test0"})
    assert loaded.status_code == 200

    entries = client.get("/api/campaign/chronicle").json()["entries"]
    assert [e["title"] for e in entries] == ["First", "Second"]


def test_list_requires_campaign(client):
    assert client.get("/api/campaign/chronicle").status_code == 404
