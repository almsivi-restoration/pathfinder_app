"""Venue persistence, validation, player-safe projection, and export/import, exercised through the
real routes (client fixture) plus StateManager where the disk layout itself is under test."""

import json


def new_campaign(client, name="Venues"):
    client.post("/api/campaign/new", params={"name": name, "ruleset": "1e"})


def new_venue(client, name="Crypt", width=10, height=8):
    response = client.post("/api/venue/new", json={"name": name, "width": width, "height": height})
    assert response.status_code == 200, response.text
    return response.json()


def furnished(venue):
    """A venue holding one of every GM-sensitive thing the projection must handle."""
    return {
        **venue,
        "notes": "The lich hides behind the false wall.",
        "cells": {"0,0": "floor", "1,0": "floor", "2,0": "water"},
        "edges": [
            {"x": 1, "y": 0, "side": "w", "kind": "door"},
            {"x": 2, "y": 0, "side": "w", "kind": "secret_door"},
        ],
        "features": [
            {"id": "f1", "kind": "stairs_down", "x": 0, "y": 0, "rotation": 90},
            {"id": "f2", "kind": "trap", "x": 1, "y": 0, "label": "Pit trap", "gm_only": True},
            {"id": "f3", "kind": "label", "x": 2, "y": 0, "label": "Throne"},
        ],
    }


def test_venue_crud_roundtrip(client):
    new_campaign(client)
    venue = new_venue(client)
    assert venue["grid"] == "square"
    assert (venue["width"], venue["height"]) == (10, 8)
    assert venue["cells"] == {} and venue["edges"] == [] and venue["features"] == []

    listing = client.get("/api/venues").json()
    assert [v["name"] for v in listing["venues"]] == ["Crypt"]
    assert "cells" not in listing["venues"][0]  # summaries stay light
    assert listing["shown_venue_id"] is None

    response = client.put(f"/api/venue/{venue['id']}", json={**furnished(venue), "name": "  Lich Crypt  "})
    assert response.status_code == 200, response.text
    saved = response.json()
    assert saved["name"] == "Lich Crypt"
    assert saved["created_at"] == venue["created_at"]
    assert saved["updated_at"] != venue["updated_at"]

    fetched = client.get(f"/api/venue/{venue['id']}").json()
    assert fetched["cells"] == {"0,0": "floor", "1,0": "floor", "2,0": "water"}
    assert [e["kind"] for e in fetched["edges"]] == ["door", "secret_door"]
    assert fetched["features"][0]["rotation"] == 90
    assert fetched["notes"].startswith("The lich")

    # The path id wins over a mismatched body id.
    response = client.put(f"/api/venue/{venue['id']}", json={**fetched, "id": "someone-else"})
    assert response.json()["id"] == venue["id"]

    assert client.delete(f"/api/venue/{venue['id']}").json() == {"status": "removed"}
    assert client.get("/api/venues").json()["venues"] == []
    assert client.get(f"/api/venue/{venue['id']}").status_code == 404
    assert client.delete(f"/api/venue/{venue['id']}").status_code == 404


def test_venue_routes_require_a_campaign(client):
    assert client.get("/api/venues").status_code == 404
    response = client.post("/api/venue/new", json={"name": "Crypt", "width": 5, "height": 5})
    assert response.status_code == 400
    assert client.get("/api/venue/anything").status_code == 404
    assert client.get("/api/venue/shown").json() == {"venue": None}


def test_venue_validation_rejects_contents_outside_the_grid(client):
    new_campaign(client)
    venue = new_venue(client, width=4, height=3)
    bad_payloads = [
        {**venue, "name": "   "},
        {**venue, "width": 0},
        {**venue, "width": 101},
        {**venue, "grid": "hex"},
        {**venue, "cells": {"4,0": "floor"}},
        {**venue, "cells": {"0,3": "floor"}},
        {**venue, "cells": {"a,b": "floor"}},
        {**venue, "cells": {"0,0": ""}},
        {**venue, "edges": [{"x": 4, "y": 0, "side": "n", "kind": "wall"}]},
        {**venue, "edges": [{"x": 0, "y": 3, "side": "w", "kind": "wall"}]},
        {**venue, "edges": [{"x": 0, "y": 0, "side": "e", "kind": "wall"}]},
        {**venue, "edges": [{"x": 0, "y": 0, "side": "n", "kind": "wall"}] * 2},
        {**venue, "features": [{"id": "f", "kind": "chest", "x": 4, "y": 0}]},
        {**venue, "features": [{"id": "f", "kind": "chest", "x": 0, "y": 0, "rotation": 45}]},
        {**venue, "features": [{"id": "f", "kind": "chest", "x": 0, "y": 0}] * 2},
        # A stamp's whole footprint must fit, and no side may pass 8 squares.
        {**venue, "features": [{"id": "f", "kind": "statue", "x": 3, "y": 0, "width": 2}]},
        {**venue, "features": [{"id": "f", "kind": "statue", "x": 0, "y": 2, "height": 2}]},
        {**venue, "features": [{"id": "f", "kind": "statue", "x": 0, "y": 0, "width": 0}]},
        {**venue, "features": [{"id": "f", "kind": "actor", "x": 0, "y": 0, "color": "red"}]},
    ]
    for payload in bad_payloads:
        response = client.put(f"/api/venue/{venue['id']}", json=payload)
        assert response.status_code in (400, 422), payload

    # The far border is addressable: bottom edge at y == height, right edge at x == width.
    border = {**venue, "edges": [
        {"x": 3, "y": 3, "side": "n", "kind": "wall"},
        {"x": 4, "y": 2, "side": "w", "kind": "door"},
    ]}
    assert client.put(f"/api/venue/{venue['id']}", json=border).status_code == 200
    sized = {**venue, "features": [{"id": "f", "kind": "statue", "x": 2, "y": 1, "width": 2, "height": 2}]}
    response = client.put(f"/api/venue/{venue['id']}", json=sized)
    assert response.status_code == 200, response.text
    assert (response.json()["features"][0]["width"], response.json()["features"][0]["height"]) == (2, 2)
    actor = {**venue, "features": [
        {"id": "f", "kind": "actor", "x": 0, "y": 0, "label": "Grishnak", "symbol": "star", "color": "#c03030"},
    ]}
    response = client.put(f"/api/venue/{venue['id']}", json=actor)
    assert response.status_code == 200, response.text
    placed = response.json()["features"][0]
    assert (placed["label"], placed["symbol"], placed["color"]) == ("Grishnak", "star", "#c03030")
    # Unknown catalog ids survive, so a newer frontend's pieces are not lost by an older backend.
    future = {**venue, "cells": {"0,0": "lava_v2"}, "features": [{"id": "f", "kind": "teleporter", "x": 0, "y": 0}]}
    assert client.put(f"/api/venue/{venue['id']}", json=future).status_code == 200


def test_venue_ids_cannot_escape_the_venues_folder(client, tmp_path):
    new_campaign(client)
    (tmp_path / "campaigns" / "Venues" / "secret.json").write_text("{}")
    for venue_id in ["..%2Fsecret", "..", "a.b", "secret%00"]:
        assert client.get(f"/api/venue/{venue_id}").status_code == 404, venue_id
        assert client.delete(f"/api/venue/{venue_id}").status_code == 404, venue_id
    assert client.post("/api/venue/show", params={"venue_id": "../secret"}).status_code == 404


def test_venue_screen_receives_only_the_player_safe_projection(client):
    new_campaign(client)
    venue = new_venue(client)
    client.put(f"/api/venue/{venue['id']}", json=furnished(venue))

    assert client.post("/api/venue/show", params={"venue_id": venue["id"]}).json() == {"shown_venue_id": venue["id"]}
    assert client.get("/api/venues").json()["shown_venue_id"] == venue["id"]
    shown = client.get("/api/venue/shown").json()["venue"]

    assert "notes" not in shown
    assert [f["id"] for f in shown["features"]] == ["f1", "f3"]
    assert [e["kind"] for e in shown["edges"]] == ["door", "wall"]
    serialized = json.dumps(shown)
    for secret in ["lich hides", "Pit trap", "secret_door", "trap"]:
        assert secret not in serialized

    # Saves appear live on the screen; hiding clears it.
    client.put(f"/api/venue/{venue['id']}", json={**furnished(venue), "cells": {"5,5": "floor"}})
    assert client.get("/api/venue/shown").json()["venue"]["cells"] == {"5,5": "floor"}
    assert client.post("/api/venue/hide").json() == {"shown_venue_id": None}
    assert client.get("/api/venue/shown").json() == {"venue": None}


def test_rooms_nest_inside_venues_without_cycles_and_passages_stay_gm_side(client):
    new_campaign(client)
    mansion = new_venue(client, name="Mansion")
    response = client.post("/api/venue/new", json={"name": "Library", "width": 6, "height": 6, "parent_id": mansion["id"]})
    assert response.status_code == 200, response.text
    library = response.json()
    study = client.post("/api/venue/new", json={"name": "Study", "width": 4, "height": 4, "parent_id": library["id"]}).json()
    assert client.post("/api/venue/new", json={"name": "X", "width": 4, "height": 4, "parent_id": "missing"}).status_code == 400

    summaries = {v["name"]: v for v in client.get("/api/venues").json()["venues"]}
    assert (summaries["Library"]["parent_id"], summaries["Mansion"]["parent_id"]) == (mansion["id"], None)
    # No venue may end up inside itself, directly or through its own rooms.
    for parent in [mansion["id"], study["id"]]:
        response = client.put(f"/api/venue/{mansion['id']}", json={**mansion, "parent_id": parent})
        assert response.status_code in (400, 422), parent
    # A parent deleted while the room was open in the editor lifts it instead of failing the save.
    assert client.put(f"/api/venue/{mansion['id']}", json={**mansion, "parent_id": "missing"}).json()["parent_id"] is None

    passage = {"id": "p", "kind": "passage", "x": 0, "y": 0, "target_venue_id": library["id"]}
    saved = client.put(f"/api/venue/{mansion['id']}", json={**mansion, "features": [passage]}).json()
    assert saved["features"][0]["target_venue_id"] == library["id"]
    client.post("/api/venue/show", params={"venue_id": mansion["id"]})
    shown = client.get("/api/venue/shown").json()["venue"]
    assert shown["features"][0]["kind"] == "passage"
    assert library["id"] not in json.dumps(shown) and "parent_id" not in shown

    # Deleting a venue lifts its rooms to the top level.
    assert client.delete(f"/api/venue/{library['id']}").status_code == 200
    assert client.get(f"/api/venue/{study['id']}").json()["parent_id"] is None


def test_import_keeps_nesting_but_lifts_rooms_with_broken_parents(client):
    new_campaign(client, "Origin")
    mansion = new_venue(client, name="Mansion")
    hall = client.post("/api/venue/new", json={"name": "Hall", "width": 4, "height": 4, "parent_id": mansion["id"]}).json()
    bundle = client.get("/api/campaign/export", params={"name": "Origin"}).json()
    by_name = {venue["name"]: venue for venue in bundle["venues"]}
    orphan = {**by_name["Hall"], "id": "orphan", "name": "Orphan", "parent_id": "not-in-bundle"}
    loop_a = {**by_name["Hall"], "id": "loop-a", "name": "Loop A", "parent_id": "loop-b"}
    loop_b = {**by_name["Hall"], "id": "loop-b", "name": "Loop B", "parent_id": "loop-a"}
    bundle["venues"] += [orphan, loop_a, loop_b]

    response = client.post("/api/campaign/import", json=bundle)
    assert response.status_code == 200, response.text
    client.post("/api/campaign/load", params={"name": "Origin (imported)"})
    parents = {v["name"]: v["parent_id"] for v in client.get("/api/venues").json()["venues"]}
    assert parents == {"Mansion": None, "Hall": mansion["id"], "Orphan": None, "Loop A": None, "Loop B": None}
    assert hall["parent_id"] == mansion["id"]


def test_shown_venue_clears_on_delete_and_campaign_switch(client):
    new_campaign(client, "First")
    venue = new_venue(client)
    client.post("/api/venue/show", params={"venue_id": venue["id"]})
    client.delete(f"/api/venue/{venue['id']}")
    assert client.get("/api/venue/shown").json() == {"venue": None}

    venue = new_venue(client)
    client.post("/api/venue/show", params={"venue_id": venue["id"]})
    new_campaign(client, "Second")
    assert client.get("/api/venue/shown").json() == {"venue": None}

    client.post("/api/venue/show", params={"venue_id": new_venue(client)["id"]})
    client.post("/api/campaign/load", params={"name": "First"})
    assert client.get("/api/venue/shown").json() == {"venue": None}
    assert client.post("/api/venue/show", params={"venue_id": "missing"}).status_code == 404


def test_export_carries_venues_and_import_restores_them(client):
    new_campaign(client, "Origin")
    venue = new_venue(client)
    client.put(f"/api/venue/{venue['id']}", json=furnished(venue))
    other = new_venue(client, name="Alley", width=3, height=20)

    bundle = client.get("/api/campaign/export", params={"name": "Origin"}).json()
    assert bundle["version"] == 4
    assert {v["id"] for v in bundle["venues"]} == {venue["id"], other["id"]}
    exported = next(v for v in bundle["venues"] if v["id"] == venue["id"])
    assert exported["notes"].startswith("The lich")  # export is the GM's full copy

    response = client.post("/api/campaign/import", json=bundle)
    assert response.status_code == 200, response.text
    client.post("/api/campaign/load", params={"name": "Origin (imported)"})
    imported = client.get(f"/api/venue/{venue['id']}").json()
    assert imported["cells"] == exported["cells"]
    assert imported["features"] == exported["features"]
    assert sorted(v["name"] for v in client.get("/api/venues").json()["venues"]) == ["Alley", "Crypt"]


def test_import_accepts_older_bundles_and_rejects_bad_venues(client):
    new_campaign(client, "Origin")
    venue = new_venue(client)
    bundle = client.get("/api/campaign/export", params={"name": "Origin"}).json()

    legacy = {key: value for key, value in bundle.items() if key != "venues"}
    legacy["version"] = 1
    response = client.post("/api/campaign/import", json=legacy)
    assert response.status_code == 200, response.text
    client.post("/api/campaign/load", params={"name": response.json()["name"]})
    assert client.get("/api/venues").json()["venues"] == []

    response = client.post("/api/campaign/import", json={**bundle, "version": 3})
    assert response.status_code == 200, response.text

    bad_bundles = [
        {**bundle, "venues": [{**bundle["venues"][0], "id": "../escape"}]},
        {**bundle, "venues": [bundle["venues"][0], bundle["venues"][0]]},
        {**bundle, "venues": [{**bundle["venues"][0], "cells": {"99,99": "floor"}}]},
        {**bundle, "venues": [{"id": venue["id"]}]},
        {**bundle, "version": 5},
    ]
    for bad_bundle in bad_bundles:
        response = client.post("/api/campaign/import", json=bad_bundle)
        assert response.status_code == 400, bad_bundle
        assert response.json()["detail"]


PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
SVG_BYTES = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'


def upload_stamp(client, data, filename="statue.png", **form):
    return client.post("/api/venue/stamps", files={"file": (filename, data)}, data=form)


def test_custom_stamps_are_judged_by_content_and_served_with_a_locked_down_policy(client):
    assert client.get("/api/venue/stamps").status_code == 404  # no campaign yet
    new_campaign(client)

    png = upload_stamp(client, PNG_BYTES, filename="Gargoyle Statue.png")
    assert png.status_code == 200, png.text
    assert (png.json()["name"], png.json()["mat_glyph"], png.json()["media_type"]) == ("Gargoyle Statue", "G", "image/png")
    # Content decides the type, not the file name.
    svg = upload_stamp(client, SVG_BYTES, filename="altar.png", name="Altar", mat_glyph="Al")
    assert svg.json()["media_type"] == "image/svg+xml"

    for data in [b"", b"GIF89a....", b'<!DOCTYPE svg [<!ENTITY x "y">]><svg/>', PNG_BYTES + b"\x00" * (512 * 1024)]:
        assert upload_stamp(client, data).status_code == 400, data[:20]

    listed = client.get("/api/venue/stamps").json()["stamps"]
    assert [stamp["name"] for stamp in listed] == ["Altar", "Gargoyle Statue"]

    image = client.get(f"/api/venue/stamps/{svg.json()['id']}/image")
    assert image.status_code == 200
    assert image.headers["content-type"].startswith("image/svg+xml")
    assert "default-src 'none'" in image.headers["content-security-policy"]
    assert image.content == SVG_BYTES

    renamed = client.put(f"/api/venue/stamps/{png.json()['id']}", json={"name": "Gargoyle", "mat_glyph": "Gy"})
    assert renamed.json()["mat_glyph"] == "Gy"
    assert client.delete(f"/api/venue/stamps/{png.json()['id']}").status_code == 200
    assert client.get(f"/api/venue/stamps/{png.json()['id']}/image").status_code == 404
    assert client.get("/api/venue/stamps/..%2Fcampaign/image").status_code == 404
    # The route never shadows venue lookups, and venues reference stamps by id.
    venue = new_venue(client, width=4, height=4)
    placed = {**venue, "features": [{"id": "f", "kind": "custom", "x": 0, "y": 0, "stamp_id": svg.json()["id"]}]}
    assert client.put(f"/api/venue/{venue['id']}", json=placed).json()["features"][0]["stamp_id"] == svg.json()["id"]


def test_export_v3_carries_custom_stamp_images_and_rejects_forged_ones(client):
    new_campaign(client, "Origin")
    stamp = upload_stamp(client, SVG_BYTES, filename="altar.svg").json()
    bundle = client.get("/api/campaign/export", params={"name": "Origin"}).json()
    assert [entry["id"] for entry in bundle["stamps"]] == [stamp["id"]]

    response = client.post("/api/campaign/import", json=bundle)
    assert response.status_code == 200, response.text
    client.post("/api/campaign/load", params={"name": "Origin (imported)"})
    assert client.get(f"/api/venue/stamps/{stamp['id']}/image").content == SVG_BYTES

    entry = bundle["stamps"][0]
    forged = [
        {**entry, "data": "not base64!"},
        {**entry, "media_type": "image/png"},
        {**entry, "id": "../escape"},
        {**entry, "data": "R0lGODlh"},
    ]
    for bad in forged:
        assert client.post("/api/campaign/import", json={**bundle, "stamps": [bad]}).status_code == 400, bad
    assert client.post("/api/campaign/import", json={**bundle, "stamps": [entry, entry]}).status_code == 400


def test_venues_live_in_their_own_folder_and_follow_a_rename(state_manager):
    state_manager.create_campaign("Old Name", "1e")
    state_manager.save_campaign()
    venue = state_manager.create_venue("Crypt", 5, 5)
    venue_file = state_manager.campaigns_dir / "Old Name" / "venues" / f"{venue.id}.json"
    assert venue_file.is_file()
    campaign_json = (state_manager.campaigns_dir / "Old Name" / "campaign.json").read_text()
    assert venue.id not in campaign_json  # the folder is the index

    state_manager.rename_campaign("Old Name", "New Name")
    assert state_manager.get_venue(venue.id).name == "Crypt"
    assert [v.id for v in state_manager.list_venues()] == [venue.id]


def test_unreadable_venue_files_are_skipped_not_fatal(state_manager):
    state_manager.create_campaign("Mixed", "1e")
    state_manager.save_campaign()
    good = state_manager.create_venue("Good", 3, 3)
    venues_dir = state_manager.campaigns_dir / "Mixed" / "venues"
    (venues_dir / "broken.json").write_text("{not json")
    (venues_dir / "invalid.json").write_text(json.dumps({"id": "invalid", "name": "X", "width": 0, "height": 1}))
    (venues_dir / "leftover.tmp").write_text("partial")

    assert [v.id for v in state_manager.list_venues()] == [good.id]
    assert state_manager.get_venue("../campaign") is None
