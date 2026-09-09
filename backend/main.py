"""
FastAPI backend for Game Master's Workbench.
Provides REST API for campaign, scene, actor, and initiative management.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool
import os
import uvicorn
import random
from typing import Optional
from uuid import uuid4

from bestiary import BestiaryLibrary
from models import Actor, Campaign, Scene, RollRequest, RollResult, Effect, InitiativeOrderRequest, ReferenceImportRequest, ChronicleEntryRequest
from name_generator import generate_names, list_categories
from reference_library import ReferenceLibrary
from sheet_importer import SheetImporter
from state import StateManager
from rules import RULESETS, get_ruleset, list_rulesets

app = FastAPI(title="Game Master's Workbench API")

# CORS middleware to allow frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data locations: env vars in the packaged app (Electron sets them to the
# per-user data directory), repo-relative defaults in development.
campaigns_dir = os.environ.get("GM_WORKBENCH_CAMPAIGNS_DIR", "./campaigns")

# Initialize state manager
state_manager = StateManager(campaigns_dir=campaigns_dir)
reference_library = ReferenceLibrary()
bestiary_library = BestiaryLibrary()
sheet_importer = SheetImporter()

# Create the per-ruleset PDF drop directories so users can find them without
# reading documentation; reference PDFs themselves are user-supplied.
reference_library.ensure_source_directories(
    [config["reference_directory"] for config in RULESETS.values()]
)

# ==================== Campaign Routes ====================

@app.post("/api/campaign/new")
def create_campaign(name: str, ruleset: str):
    """Create a new campaign."""
    try:
        campaign = state_manager.create_campaign(name, ruleset)
        state_manager.save_campaign(campaign)
        return campaign.model_dump()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/campaign/list")
def list_campaigns():
    """List all saved campaigns."""
    campaigns = state_manager.list_campaigns()
    return {"campaigns": campaigns}


@app.post("/api/campaign/load")
def load_campaign(name: str):
    """Load a campaign by name."""
    campaign = state_manager.load_campaign(name)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign.model_dump()


@app.get("/api/campaign/current")
def get_current_campaign():
    """Get the currently loaded campaign."""
    if not state_manager.current_campaign:
        raise HTTPException(status_code=404, detail="No campaign loaded")
    return state_manager.current_campaign.model_dump()


@app.post("/api/campaign/save")
def save_campaign():
    """Save the current campaign."""
    if state_manager.save_campaign():
        return {"status": "saved"}
    raise HTTPException(status_code=400, detail="No campaign to save")


@app.delete("/api/campaign/{campaign_name}")
def delete_campaign(campaign_name: str):
    """Delete one persisted campaign and all scenes saved under it."""
    if not state_manager.delete_campaign(campaign_name):
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"status": "removed"}


# ==================== Scene Routes ====================

@app.post("/api/scene/new")
def create_scene(name: str):
    """Create a new scene in the current campaign."""
    try:
        scene = state_manager.create_scene(name)
        return scene.model_dump()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/scenes")
def list_scenes():
    """List saved scenes for the current campaign."""
    if not state_manager.current_campaign:
        raise HTTPException(status_code=404, detail="No campaign loaded")
    return {"scenes": [scene.model_dump() for scene in state_manager.list_scenes()]}


@app.get("/api/scene/current")
def get_current_scene():
    """Get the currently loaded scene."""
    if not state_manager.current_scene:
        raise HTTPException(status_code=404, detail="No scene loaded")
    return state_manager.current_scene.model_dump()


@app.post("/api/scene/load")
def load_scene(scene_id: str):
    """Load an scene by ID."""
    scene = state_manager.load_scene(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene.model_dump()


@app.post("/api/scene/close")
def close_scene():
    """Close the active scene without deleting it."""
    if not state_manager.close_scene():
        raise HTTPException(status_code=404, detail="No scene loaded")
    return {"status": "closed"}


@app.delete("/api/scene/{scene_id}")
def delete_scene(scene_id: str):
    """Delete one saved scene from the current campaign."""
    if not state_manager.delete_scene(scene_id):
        raise HTTPException(status_code=404, detail="Scene not found")
    return {"status": "removed"}


@app.post("/api/scene/save")
def save_scene():
    """Save the current scene."""
    if state_manager.save_scene():
        return {"status": "saved"}
    raise HTTPException(status_code=400, detail="No scene to save")


# ==================== Actor Routes ====================

@app.post("/api/actor/add")
def add_actor(actor: Actor):
    """Add an actor to the current scene."""
    if not state_manager.current_scene:
        raise HTTPException(status_code=400, detail="No scene loaded")
    
    # Assign ID if not present
    if not actor.id:
        actor.id = str(uuid4())
    
    state_manager.add_actor(actor)
    return actor.model_dump()


@app.get("/api/actor/{actor_id}")
def get_actor(actor_id: str):
    """Get actor details."""
    actor = state_manager.get_actor(actor_id)
    if not actor:
        raise HTTPException(status_code=404, detail="Actor not found")
    return actor.model_dump()


@app.put("/api/actor/{actor_id}")
def update_actor(actor_id: str, actor: Actor):
    """Update an actor."""
    if not state_manager.update_actor(actor_id, actor):
        raise HTTPException(status_code=404, detail="Actor not found")
    return actor.model_dump()


@app.delete("/api/actor/{actor_id}")
def remove_actor(actor_id: str):
    """Remove an actor from the current scene."""
    if not state_manager.remove_actor(actor_id):
        raise HTTPException(status_code=404, detail="Actor not found")
    return {"status": "removed"}


# ==================== Actor Template Routes ====================

@app.post("/api/campaign/actor-template/add")
def add_actor_template(actor: Actor):
    """Save an actor as a reusable template on the current campaign."""
    template = state_manager.add_actor_template(actor)
    if not template:
        raise HTTPException(status_code=400, detail="No campaign loaded")
    return template.model_dump()


@app.get("/api/campaign/actor-templates")
def list_actor_templates():
    """List actor templates saved on the current campaign."""
    return {"templates": [t.model_dump() for t in state_manager.list_actor_templates()]}


@app.delete("/api/campaign/actor-template/{template_id}")
def remove_actor_template(template_id: str):
    """Remove an actor template from the current campaign."""
    if not state_manager.remove_actor_template(template_id):
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "removed"}


@app.put("/api/campaign/actor-template/{template_id}")
def update_actor_template(template_id: str, actor: Actor):
    """Update an actor template on the current campaign."""
    template = state_manager.update_actor_template(template_id, actor)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template.model_dump()


@app.post("/api/scene/actor/from-template/{template_id}")
def add_actor_from_template(template_id: str):
    """Instantiate a campaign actor template into the current scene."""
    actor = state_manager.instantiate_template(template_id)
    if not actor:
        raise HTTPException(status_code=404, detail="Template or scene not found")
    return actor.model_dump()


# ==================== Chronicle Routes ====================

@app.post("/api/campaign/chronicle/add")
def add_chronicle_entry(entry: ChronicleEntryRequest):
    """Append a journal entry to the current campaign's chronicle."""
    if not entry.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    created = state_manager.add_chronicle_entry(entry.title.strip(), entry.body)
    if not created:
        raise HTTPException(status_code=400, detail="No campaign loaded")
    return created.model_dump()


@app.get("/api/campaign/chronicle")
def list_chronicle_entries():
    """List the current campaign's chronicle entries, oldest first."""
    if not state_manager.current_campaign:
        raise HTTPException(status_code=404, detail="No campaign loaded")
    return {"entries": [e.model_dump() for e in state_manager.list_chronicle_entries()]}


@app.put("/api/campaign/chronicle/{entry_id}")
def update_chronicle_entry(entry_id: str, entry: ChronicleEntryRequest):
    """Update a chronicle entry on the current campaign."""
    if not entry.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")
    updated = state_manager.update_chronicle_entry(entry_id, entry.title.strip(), entry.body)
    if not updated:
        raise HTTPException(status_code=404, detail="Chronicle entry not found")
    return updated.model_dump()


@app.delete("/api/campaign/chronicle/{entry_id}")
def remove_chronicle_entry(entry_id: str):
    """Remove a chronicle entry from the current campaign."""
    if not state_manager.remove_chronicle_entry(entry_id):
        raise HTTPException(status_code=404, detail="Chronicle entry not found")
    return {"status": "removed"}


# ==================== Initiative Routes ====================

@app.post("/api/initiative/set")
def set_initiative_order(request: InitiativeOrderRequest):
    """Explicitly set/reorder initiative (GM-controlled, e.g. from a physical die roll)."""
    if not state_manager.set_initiative_order(request.actor_ids):
        raise HTTPException(status_code=400, detail="No scene loaded")
    
    scene = state_manager.current_scene
    return {
        "initiative_order": scene.initiative_order,
        "round": scene.current_round,
        "current_turn_index": scene.current_turn_index,
    }


@app.post("/api/initiative/roll")
def roll_initiative():
    """Roll initiative for all actors in the current scene."""
    if not state_manager.roll_initiative():
        raise HTTPException(status_code=400, detail="Could not roll initiative")
    
    scene = state_manager.current_scene
    return {
        "initiative_order": scene.initiative_order,
        "round": scene.current_round,
        "current_turn_index": scene.current_turn_index,
    }


@app.post("/api/initiative/next")
def next_turn():
    """Advance to the next turn."""
    next_actor_id = state_manager.next_turn()
    if not next_actor_id:
        raise HTTPException(status_code=400, detail="Could not advance turn")
    
    scene = state_manager.current_scene
    return {
        "next_actor_id": next_actor_id,
        "round": scene.current_round,
        "turn_index": scene.current_turn_index,
    }


@app.get("/api/initiative/state")
def get_initiative_state():
    """Get current initiative state."""
    if not state_manager.current_scene:
        raise HTTPException(status_code=404, detail="No scene loaded")
    
    scene = state_manager.current_scene
    return {
        "initiative_order": scene.initiative_order,
        "round": scene.current_round,
        "current_turn_index": scene.current_turn_index,
    }


# ==================== Roll Routes ====================

@app.post("/api/roll")
def roll_dice(request: RollRequest):
    """Roll d20 + modifiers."""
    die_roll = random.randint(1, request.die_type)
    bonus_dice_roll = None
    
    if request.bonus_dice > 0:
        bonus_dice_roll = sum(random.randint(1, 20) for _ in range(request.bonus_dice))
    
    total = die_roll + request.modifier
    if bonus_dice_roll:
        total += bonus_dice_roll
    
    return RollResult(
        die_roll=die_roll,
        modifier=request.modifier,
        bonus_dice_roll=bonus_dice_roll,
        total=total,
    ).model_dump()


# ==================== Sheet Import Routes ====================

@app.post("/api/import/sheet")
async def import_character_sheet(file: UploadFile = File(...)):
    """OCR a scanned Pathfinder 1e character sheet into a reviewable actor draft.

    Draft-only: returns extracted fields and warnings for GM review; nothing is
    persisted here. The review UI confirms values and then uses the existing
    addActor / saveActorTemplate actions.
    """
    if not state_manager.current_campaign:
        raise HTTPException(status_code=404, detail="No campaign loaded")
    if state_manager.current_campaign.ruleset != "1e":
        raise HTTPException(status_code=400, detail="Sheet import currently supports Pathfinder 1e only")
    if not sheet_importer.ocr_available():
        # detail carries {message, venv_dir, commands} so the dialog can show
        # install instructions that are actually correct for this machine.
        raise HTTPException(status_code=503, detail=sheet_importer.ocr_install_guidance())
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Upload a PDF of the character sheet")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    try:
        # OCR is a subprocess plus model inference (and a first-run ~230MB
        # model download): far too slow to block the event loop.
        return await run_in_threadpool(sheet_importer.import_pathfinder_1e, pdf_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read character sheet: {e}")


# ==================== Rules Routes ====================

def get_current_ruleset_name() -> str:
    if not state_manager.current_campaign:
        raise HTTPException(status_code=404, detail="No campaign loaded")
    return state_manager.current_campaign.ruleset


def get_current_ruleset_definition():
    ruleset = get_current_ruleset_name()
    config = get_ruleset(ruleset)
    if not config:
        raise HTTPException(status_code=404, detail="Ruleset not found")
    return ruleset, config


@app.get("/api/references/current")
def get_current_references():
    """List local PDFs and indexed documents for the active campaign's ruleset."""
    ruleset, config = get_current_ruleset_definition()
    return {
        "ruleset": ruleset,
        "source_files": reference_library.available_sources(ruleset, config["reference_directory"]),
        "documents": reference_library.list_documents(ruleset),
        "ocr_available": reference_library.ocr_available(),
    }


@app.post("/api/references/current/import")
def import_current_reference(request: ReferenceImportRequest):
    """Index a local PDF registered under the active campaign's ruleset."""
    ruleset, config = get_current_ruleset_definition()
    try:
        return reference_library.import_source(ruleset, request.filename, config["reference_directory"])
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Could not index reference: {error}")


@app.get("/api/references/current/files/{filename}")
def get_current_reference_file(filename: str):
    """Serve one local PDF from the active campaign ruleset to the Encyclopedia Reader."""
    ruleset, config = get_current_ruleset_definition()
    source_path = reference_library.get_source_path(ruleset, filename, config["reference_directory"])
    if not source_path:
        raise HTTPException(status_code=404, detail="Reference PDF not found")
    return FileResponse(source_path, media_type="application/pdf", filename=source_path.name)


@app.get("/api/references/current/search")
def search_current_references(query: str, limit: int = 20):
    """Search only the local reference index for the active campaign's ruleset."""
    ruleset, _ = get_current_ruleset_definition()
    return {"results": reference_library.search(ruleset, query, limit)}


# ==================== Bestiary Routes ====================

@app.get("/api/bestiary/current/status")
def get_bestiary_status():
    """Report whether the ruleset bestiary CSV is present and/or indexed."""
    ruleset, config = get_current_ruleset_definition()
    return bestiary_library.status(ruleset, config["reference_directory"])


@app.post("/api/bestiary/current/import")
def import_current_bestiary():
    """Parse and index the bestiary CSV dropped into the ruleset sources directory."""
    ruleset, config = get_current_ruleset_definition()
    try:
        return bestiary_library.import_source(ruleset, config["reference_directory"])
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Could not import bestiary: {error}")


@app.get("/api/bestiary/current/search")
def search_current_bestiary(
    query: str = "",
    cr_min: Optional[float] = None,
    cr_max: Optional[float] = None,
    monster_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """Search the indexed bestiary for the active campaign's ruleset."""
    ruleset, _ = get_current_ruleset_definition()
    return bestiary_library.search(ruleset, query, cr_min, cr_max, monster_type, limit, offset)


@app.get("/api/bestiary/current/entry/{entry_id}")
def get_bestiary_entry(entry_id: int):
    """Return one full normalized bestiary record."""
    ruleset, _ = get_current_ruleset_definition()
    entry = bestiary_library.get_entry(ruleset, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Bestiary entry not found")
    return entry


@app.get("/api/bestiary/current/entry/{entry_id}/actor")
def get_bestiary_entry_as_actor(entry_id: int):
    """Map one bestiary record onto a new NPC actor payload using the ruleset mapper."""
    ruleset, config = get_current_ruleset_definition()
    mapper = config.get("bestiary_mapper")
    if not mapper:
        raise HTTPException(status_code=404, detail="The active ruleset has no bestiary mapping")
    entry = bestiary_library.get_entry(ruleset, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Bestiary entry not found")
    return mapper(entry)


@app.get("/api/rulesets")
def get_available_rulesets():
    """List rulesets available for new campaigns."""
    return {"rulesets": list_rulesets()}


@app.get("/api/rules/current")
def get_current_ruleset_config():
    """Get sheet configuration for the current campaign's ruleset."""
    if not state_manager.current_campaign:
        raise HTTPException(status_code=404, detail="No campaign loaded")

    config = get_ruleset(state_manager.current_campaign.ruleset)
    if not config:
        raise HTTPException(status_code=404, detail="Ruleset not found")
    return {
        "name": config["name"],
        "abilities": config["abilities"],
        "skills": config["skills"],
        "saves": config["saves"],
        "max_level": config["max_level"],
        "reference_directory": config["reference_directory"],
        "actor_sheet": config["actor_sheet"],
        "monster_sheet": config.get("monster_sheet"),
    }


# ==================== Health Check ====================

@app.get("/api/names/categories")
def name_categories():
    """Describe the name generator categories and per-ruleset races for the UI."""
    base = list_categories()
    races = []
    if state_manager.current_campaign:
        config = get_ruleset(state_manager.current_campaign.ruleset)
        if config:
            races = config.get("races", [])
    return {**base, "races": races}


@app.get("/api/names/generate")
def generate_name(category: str, count: int = 5, race: Optional[str] = None, place_level: Optional[str] = None):
    """Generate random fantasy names for the GM Tools name generator."""
    try:
        return {"names": generate_names(category, count, race, place_level)}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/health")
def health_check():
    """Health check endpoint. Includes the app version so the desktop shell can
    tell its own freshly spawned backend apart from a stale or foreign server
    already holding the port."""
    return {"status": "ok", "version": os.environ.get("GM_WORKBENCH_VERSION", "unknown")}


# ==================== Main ====================

if __name__ == "__main__":
    # Loopback-only by default: this is a single-machine desktop app, and the
    # API has no authentication. Override with env vars if ever needed.
    uvicorn.run(
        app,
        host=os.environ.get("GM_WORKBENCH_HOST", "127.0.0.1"),
        port=int(os.environ.get("GM_WORKBENCH_PORT", "8000")),
    )
