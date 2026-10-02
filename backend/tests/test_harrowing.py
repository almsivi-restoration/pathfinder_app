"""Tests for The Harrowing: config persistence and the chat proxy routes.

No real model server is contacted — the httpx boundary is mocked, matching the
synthetic-fixture rule for external dependencies.
"""

import pytest

from harrowing import HarrowingClient


@pytest.fixture
def harrowing(tmp_path, monkeypatch):
    """A HarrowingClient whose settings live in an isolated temp file, wired
    into main's module-level singleton so routes use it."""
    import main

    client = HarrowingClient(settings_path=tmp_path / "harrowing-settings.json")
    monkeypatch.setattr(main, "harrowing_client", client)
    return client


def test_config_defaults_when_unset(harrowing):
    config = harrowing.get_config()
    assert config["base_url"].startswith("http")
    assert config["model"] == ""


def test_save_and_reload_config(harrowing):
    saved = harrowing.save_config("http://localhost:11434/v1/", "llama3.1:8b")
    assert saved["base_url"] == "http://localhost:11434/v1"  # trailing slash stripped
    assert saved["model"] == "llama3.1:8b"
    assert harrowing.get_config() == saved


def test_save_config_rejects_bad_input(harrowing):
    with pytest.raises(ValueError):
        harrowing.save_config("", "model")
    with pytest.raises(ValueError):
        harrowing.save_config("http://x/v1", "")
    with pytest.raises(ValueError):
        harrowing.save_config("not-a-url", "model")


def test_status_endpoint_unreachable(client, harrowing):
    # Point at a port nothing listens on so the test is independent of whether
    # a real server happens to be running on the dev machine.
    harrowing.save_config("http://127.0.0.1:59999/v1", "test-model")
    response = client.get("/api/harrowing/status")
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["error"]


def test_config_routes_round_trip(client, harrowing):
    put = client.put(
        "/api/harrowing/config",
        json={"base_url": "http://localhost:11434/v1", "model": "llama3.1:8b"},
    )
    assert put.status_code == 200
    got = client.get("/api/harrowing/config")
    assert got.json()["model"] == "llama3.1:8b"


def test_chat_requires_messages(client, harrowing):
    response = client.post("/api/harrowing/chat", json={"messages": []})
    assert response.status_code == 400


def test_chat_fails_when_no_model_configured(client, harrowing):
    response = client.post(
        "/api/harrowing/chat",
        json={"messages": [{"role": "user", "content": "hello"}]},
    )
    assert response.status_code == 503


def test_unload_route_reports_state(client, harrowing, monkeypatch):
    harrowing.save_config("http://modelserver:1234/v1", "test-model")

    calls = {}

    def fake_post(url, json, timeout):
        calls["url"] = url
        calls["body"] = json

        class _Resp:
            status_code = 200

            def json(self):
                return {}

        return _Resp()

    def fake_get(url, timeout):
        class _Resp:
            status_code = 200

            def json(self):
                return {"models": []}  # nothing resident after unload

        return _Resp()

    import harrowing as harrowing_module

    monkeypatch.setattr(harrowing_module.httpx, "post", fake_post)
    monkeypatch.setattr(harrowing_module.httpx, "get", fake_get)

    response = client.post("/api/harrowing/unload")
    assert response.status_code == 200
    body = response.json()
    assert body["unloaded"] is True
    assert body["loaded"] is False
    # Unload hits the server-root generate endpoint with keep_alive=0.
    assert calls["url"] == "http://modelserver:1234/api/generate"
    assert calls["body"] == {"model": "test-model", "keep_alive": 0}


def test_server_root_strips_v1_path():
    from harrowing import _server_root

    assert _server_root("http://localhost:11434/v1") == "http://localhost:11434"
    assert _server_root("http://modelserver:1234/v1") == "http://modelserver:1234"
    assert _server_root("https://host.example/") == "https://host.example"


def test_chat_proxies_to_endpoint(client, harrowing, monkeypatch):
    harrowing.save_config("http://modelserver:1234/v1", "test-model")

    class _FakeResponse:
        status_code = 200

        def json(self):
            return {
                "choices": [{"message": {"content": "A storm gathers over the Storval Rise."}}],
                "usage": {"total_tokens": 42},
            }

    captured = {}

    class _FakeClient:
        def __init__(self, base_url, timeout):
            captured["base_url"] = base_url

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, path, json):
            captured["path"] = path
            captured["body"] = json
            return _FakeResponse()

    import harrowing as harrowing_module

    monkeypatch.setattr(harrowing_module.httpx, "Client", _FakeClient)

    response = client.post(
        "/api/harrowing/chat",
        json={"messages": [{"role": "user", "content": "Give me a plot hook."}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["content"] == "A storm gathers over the Storval Rise."
    assert body["grounded"] is False
    # The proxy spoke to the configured server and injected the system prompt.
    assert captured["base_url"] == "http://modelserver:1234/v1"
    assert captured["path"] == "/chat/completions"
    assert captured["body"]["model"] == "test-model"
    assert captured["body"]["messages"][0]["role"] == "system"
    assert "Harrowing" in captured["body"]["messages"][0]["content"]
    assert captured["body"]["messages"][1] == {"role": "user", "content": "Give me a plot hook."}
