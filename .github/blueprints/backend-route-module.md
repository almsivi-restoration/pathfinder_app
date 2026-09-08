---
description: "Blueprint: how a FastAPI route module is shaped in Game Master's Workbench — route grouping, error shape, response shape, and state access. Load when adding or editing backend routes."
name: "bp-backend-route-module"
version: "1.0.0"
applyTo: "backend/**/*.py"
---

# Blueprint: Backend Route Module

## Purpose

All HTTP surface lives in [main.py](../../backend/main.py) as flat
FastAPI route functions, grouped by domain with banner comments. Routes
are thin: they validate presence/state, delegate to the `StateManager`
(or the domain library), and return `model_dump()` shapes.

## Holotype

```python
# ==================== Scene Routes ====================

@app.post("/api/scene/new")
def create_scene(name: str):
    """Create a new scene in the current campaign."""
    try:
        scene = state_manager.create_scene(name)
        return scene.model_dump()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/scene/current")
def get_current_scene():
    """Get the currently open scene."""
    if not state_manager.current_scene:
        raise HTTPException(status_code=404, detail="No scene open")
    return state_manager.current_scene.model_dump()
```

## Contract

- **Routes are functions on the module-level `app`**, decorated with
  `@app.get/post/put/delete`. No routers, no blueprints, no classes.
- **Route paths follow the lexicon:** `/api/<domain>/<verb-or-resource>`.
- **Errors are `HTTPException`** with a human-readable `detail` string.
  404 for missing/not-loaded state, 400 for bad input or failed ops.
- **Responses are `model_dump()`** of the Pydantic model (or plain dicts
  for list/status payloads). Never return raw model objects.
- **All persistence goes through the module-level `state_manager`
  singleton.** Route handlers never do file I/O, never instantiate
  `StateManager` themselves. The test fixture relies on reassigning
  `main.state_manager` — adding a second instance breaks test isolation.
- **Domain libraries** (`BestiaryLibrary`, `ReferenceLibrary`) are
  likewise module-level singletons constructed once at startup.
- **Docstrings:** one line, imperative, on every route.

## When this doesn't fit

A route group that genuinely outgrows the flat module (dozens of routes,
distinct dependencies) may justify an `APIRouter` — but that is a
blueprint revision, made in the same commit as the split, not a silent
local deviation.
