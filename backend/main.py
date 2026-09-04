"""
FastAPI backend for Pathfinder Encounter Manager.
Provides REST API for campaign, encounter, actor, and initiative management.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import random
from uuid import uuid4

from models import Actor, Campaign, Encounter, Ruleset, RollRequest, RollResult, Effect, InitiativeOrderRequest
from state import StateManager
from rules import get_ruleset

app = FastAPI(title="Pathfinder Encounter Manager API")

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

# ==================== Campaign Routes ====================

@app.post("/api/campaign/new")
def create_campaign(name: str, ruleset: Ruleset):
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


# ==================== Encounter Routes ====================

@app.post("/api/encounter/new")
def create_encounter(name: str, ruleset: Ruleset):
    """Create a new encounter in the current campaign."""
    try:
        encounter = state_manager.create_encounter(name, ruleset)
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

@app.get("/api/rules/{ruleset}")
def get_ruleset_config(ruleset: str):
    """Get ruleset configuration (skills, saves, abilities)."""
    config = get_ruleset(ruleset)
    if not config:
        raise HTTPException(status_code=404, detail="Ruleset not found")
    return {
        "name": config["name"],
        "abilities": config["abilities"],
        "skills": config["skills"],
        "saves": config["saves"],
        "max_level": config["max_level"],
    }


# ==================== Health Check ====================

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


# ==================== Main ====================

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
