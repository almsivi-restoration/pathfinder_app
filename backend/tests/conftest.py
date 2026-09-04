"""Ensures backend/ is importable as a flat module set (models, state, main have no package
__init__.py), regardless of the directory pytest is invoked from."""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest


@pytest.fixture
def state_manager(tmp_path):
    """A StateManager backed by an isolated temp directory - never touches backend/campaigns/."""
    from state import StateManager

    return StateManager(campaigns_dir=str(tmp_path / "campaigns"))


@pytest.fixture
def client(tmp_path):
    """A FastAPI TestClient whose global state_manager is swapped for an isolated instance.

    main.py's route handlers reference the module-level `state_manager` name, so reassigning
    `main.state_manager` here is visible to every request made through this client.
    """
    import main
    from state import StateManager
    from fastapi.testclient import TestClient

    main.state_manager = StateManager(campaigns_dir=str(tmp_path / "campaigns"))
    return TestClient(main.app)
