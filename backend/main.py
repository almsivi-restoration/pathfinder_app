"""
FastAPI backend for Game Master's Workbench.
Provides REST API for campaign, encounter, actor, and initiative management.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import random
from uuid import uuid4

from models import Actor, Campaign, Encounter, RollRequest, RollResult, Effect, InitiativeOrderRequest, ReferenceImportRequest
from reference_library import ReferenceLibrary
from state import StateManager
from rules import get_ruleset, list_rulesets

app = FastAPI(title="Game Master's Workbench API")

# CORS middleware to allow frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize state manager
state_manager = StateManager()
reference_library = ReferenceLibrary()

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
    """Delete one persisted campaign and all encounters saved under it."""
    if not state_manager.delete_campaign(campaign_name):
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"status": "removed"}


# ==================== Encounter Routes ====================

@app.post("/api/encounter/new")
def create_encounter(name: str):
    """Create a new encounter in the current campaign."""
    try:
        encounter = state_manager.create_encounter(name)
        return encounter.model_dump()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/encounter/current")
def get_current_encounter():
    """Get the currently loaded encounter."""
    if not state_manager.current_encounter:
        raise HTTPException(status_code=404, detail="No encounter loaded")
    return state_manager.current_encounter.model_dump()


@app.post("/api/encounter/load")
def load_encounter(encounter_id: str):
    """Load an encounter by ID."""
    encounter = state_manager.load_encounter(encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return encounter.model_dump()


@app.post("/api/encounter/save")
def save_encounter():
    """Save the current encounter."""
    if state_manager.save_encounter():
        return {"status": "saved"}
    raise HTTPException(status_code=400, detail="No encounter to save")


# ==================== Actor Routes ====================

@app.post("/api/actor/add")
def add_actor(actor: Actor):
    """Add an actor to the current encounter."""
    if not state_manager.current_encounter:
        raise HTTPException(status_code=400, detail="No encounter loaded")
    
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
    """Remove an actor from the current encounter."""
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


@app.post("/api/encounter/actor/from-template/{template_id}")
def add_actor_from_template(template_id: str):
    """Instantiate a campaign actor template into the current encounter."""
    actor = state_manager.instantiate_template(template_id)
    if not actor:
        raise HTTPException(status_code=404, detail="Template or encounter not found")
    return actor.model_dump()


# ==================== Initiative Routes ====================

@app.post("/api/initiative/set")
def set_initiative_order(request: InitiativeOrderRequest):
    """Explicitly set/reorder initiative (GM-controlled, e.g. from a physical die roll)."""
    if not state_manager.set_initiative_order(request.actor_ids):
        raise HTTPException(status_code=400, detail="No encounter loaded")
    
    encounter = state_manager.current_encounter
    return {
        "initiative_order": encounter.initiative_order,
        "round": encounter.current_round,
        "current_turn_index": encounter.current_turn_index,
    }


@app.post("/api/initiative/roll")
def roll_initiative():
    """Roll initiative for all actors in the current encounter."""
    if not state_manager.roll_initiative():
        raise HTTPException(status_code=400, detail="Could not roll initiative")
    
    encounter = state_manager.current_encounter
    return {
        "initiative_order": encounter.initiative_order,
        "round": encounter.current_round,
        "current_turn_index": encounter.current_turn_index,
    }


@app.post("/api/initiative/next")
def next_turn():
    """Advance to the next turn."""
    next_actor_id = state_manager.next_turn()
    if not next_actor_id:
        raise HTTPException(status_code=400, detail="Could not advance turn")
    
    encounter = state_manager.current_encounter
    return {
        "next_actor_id": next_actor_id,
        "round": encounter.current_round,
        "turn_index": encounter.current_turn_index,
    }


@app.get("/api/initiative/state")
def get_initiative_state():
    """Get current initiative state."""
    if not state_manager.current_encounter:
        raise HTTPException(status_code=404, detail="No encounter loaded")
    
    encounter = state_manager.current_encounter
    return {
        "initiative_order": encounter.initiative_order,
        "round": encounter.current_round,
        "current_turn_index": encounter.current_turn_index,
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


@app.get("/api/references/current/search")
def search_current_references(query: str, limit: int = 20):
    """Search only the local reference index for the active campaign's ruleset."""
    ruleset, _ = get_current_ruleset_definition()
    return {"results": reference_library.search(ruleset, query, limit)}

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
    }


# ==================== Health Check ====================

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


# ==================== Main ====================

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
