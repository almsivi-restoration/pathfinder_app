"""Guards the server launch configuration behind the mid-session freeze.

The desktop shell once left the backend's stdout pipe unread; uvicorn's access
log filled it after a few hundred requests and the server hung. The shell now
discards stdout, and the backend no longer writes per-request lines at all.
"""


def test_run_server_disables_access_log(monkeypatch):
    import main

    captured = {}
    monkeypatch.setattr(main.uvicorn, "run", lambda app, **kwargs: captured.update(kwargs))
    monkeypatch.delenv("GM_WORKBENCH_HOST", raising=False)
    monkeypatch.delenv("GM_WORKBENCH_PORT", raising=False)

    main.run_server()

    assert captured["access_log"] is False
    assert captured["host"] == "127.0.0.1"
    assert captured["port"] == 8000
