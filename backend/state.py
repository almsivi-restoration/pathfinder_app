"""
In-memory state manager for campaigns and encounters.
Handles CRUD operations and persistence.
"""

import json
import os
from typing import Dict, List, Optional
from pathlib import Path
from models import Campaign, Encounter, Actor, Ruleset
import uuid


class StateManager:
    def __init__(self, campaigns_dir: str = "./campaigns"):
        self.campaigns_dir = Path(campaigns_dir)
        self.campaigns_dir.mkdir(exist_ok=True)
        
        # In-memory state
        self.current_campaign: Optional[Campaign] = None
        self.current_encounter: Optional[Encounter] = None
        self.encounters: Dict[str, Encounter] = {}
        self.campaigns: Dict[str, Campaign] = {}
    
    # ==================== Campaign Methods ====================
    
    def create_campaign(self, name: str, ruleset: Ruleset) -> Campaign:
        """Create a new campaign."""
        campaign = Campaign(name=name, ruleset=ruleset)
        self.campaigns[campaign.name] = campaign
        self.current_campaign = campaign
        return campaign
    
    def load_campaign(self, campaign_name: str) -> Optional[Campaign]:
        """Load campaign from disk."""
        campaign_path = self.campaigns_dir / campaign_name / "campaign.json"
        if not campaign_path.exists():
            return None
        
        with open(campaign_path, "r") as f:
            data = json.load(f)
            campaign = Campaign(**data)
        
        self.current_campaign = campaign
        self.campaigns[campaign_name] = campaign
        return campaign
    
    def save_campaign(self, campaign: Optional[Campaign] = None) -> bool:
        """Persist campaign to disk."""
        campaign = campaign or self.current_campaign
        if not campaign:
            return False
        
        campaign_dir = self.campaigns_dir / campaign.name
        campaign_dir.mkdir(exist_ok=True)
        
        campaign_path = campaign_dir / "campaign.json"
        with open(campaign_path, "w") as f:
            json.dump(campaign.model_dump(), f, indent=2, default=str)
        
        return True
    
    def list_campaigns(self) -> List[str]:
        """List all saved campaigns."""
        return [d.name for d in self.campaigns_dir.iterdir() if d.is_dir()]
    
    # ==================== Encounter Methods ====================
    
    def create_encounter(self, name: str, ruleset: Ruleset) -> Encounter:
        """Create a new encounter."""
        encounter = Encounter(id=str(uuid.uuid4()), name=name, ruleset=ruleset)
        self.encounters[encounter.id] = encounter
        self.current_encounter = encounter
        
        if self.current_campaign:
            self.current_campaign.encounters.append(encounter.id)
        
        return encounter
    
    def load_encounter(self, encounter_id: str) -> Optional[Encounter]:
        """Load encounter from memory or disk."""
        if encounter_id in self.encounters:
            self.current_encounter = self.encounters[encounter_id]
            return self.current_encounter
        
        # Attempt to load from disk
        if self.current_campaign:
            encounter_path = self.campaigns_dir / self.current_campaign.name / "encounters" / f"{encounter_id}.json"
            if encounter_path.exists():
                with open(encounter_path, "r") as f:
                    data = json.load(f)
                    encounter = Encounter(**data)
                    self.encounters[encounter_id] = encounter
                    self.current_encounter = encounter
                    return encounter
        
        return None
    
    def save_encounter(self, encounter: Optional[Encounter] = None) -> bool:
        """Persist encounter to disk."""
        encounter = encounter or self.current_encounter
        if not encounter or not self.current_campaign:
            return False
        
        encounters_dir = self.campaigns_dir / self.current_campaign.name / "encounters"
        encounters_dir.mkdir(parents=True, exist_ok=True)
        
        encounter_path = encounters_dir / f"{encounter.id}.json"
        with open(encounter_path, "w") as f:
            json.dump(encounter.model_dump(), f, indent=2, default=str)
        
        return True
    
    # ==================== Actor Methods ====================
    
    def add_actor(self, actor: Actor) -> bool:
        """Add actor to current encounter."""
        if not self.current_encounter:
            return False
        
        self.current_encounter.actors.append(actor)
        return True
    
    def remove_actor(self, actor_id: str) -> bool:
        """Remove actor from current encounter."""
        if not self.current_encounter:
            return False
        
        self.current_encounter.actors = [a for a in self.current_encounter.actors if a.id != actor_id]
        # Remove from initiative order if present
        if actor_id in self.current_encounter.initiative_order:
            self.current_encounter.initiative_order.remove(actor_id)
        
        return True
    
    def update_actor(self, actor_id: str, updated_actor: Actor) -> bool:
        """Update an actor in the current encounter."""
        if not self.current_encounter:
            return False
        
        for i, actor in enumerate(self.current_encounter.actors):
            if actor.id == actor_id:
                self.current_encounter.actors[i] = updated_actor
                return True
        
        return False
    
    def get_actor(self, actor_id: str) -> Optional[Actor]:
        """Retrieve actor by ID from current encounter."""
        if not self.current_encounter:
            return None
        
        for actor in self.current_encounter.actors:
            if actor.id == actor_id:
                return actor
        
        return None
    
    # ==================== Actor Template Methods ====================
    
    def add_actor_template(self, actor: Actor) -> Optional[Actor]:
        """Save an actor as a reusable template on the current campaign."""
        if not self.current_campaign:
            return None
        
        if not actor.id:
            actor.id = str(uuid.uuid4())
        
        self.current_campaign.actor_templates.append(actor)
        self.save_campaign()
        return actor
    
    def remove_actor_template(self, template_id: str) -> bool:
        """Remove an actor template from the current campaign."""
        if not self.current_campaign:
            return False
        
        original_count = len(self.current_campaign.actor_templates)
        self.current_campaign.actor_templates = [
            t for t in self.current_campaign.actor_templates if t.id != template_id
        ]
        removed = len(self.current_campaign.actor_templates) != original_count
        if removed:
            self.save_campaign()
        return removed
    
    def update_actor_template(self, template_id: str, updated_actor: Actor) -> Optional[Actor]:
        """Update an actor template on the current campaign."""
        if not self.current_campaign:
            return None
        
        for i, template in enumerate(self.current_campaign.actor_templates):
            if template.id == template_id:
                updated_actor.id = template_id
                self.current_campaign.actor_templates[i] = updated_actor
                self.save_campaign()
                return updated_actor
        
        return None
    
    def list_actor_templates(self) -> List[Actor]:
        """List actor templates saved on the current campaign."""
        if not self.current_campaign:
            return []
        return self.current_campaign.actor_templates
    
    def instantiate_template(self, template_id: str) -> Optional[Actor]:
        """Copy a campaign actor template into the current encounter as a new actor."""
        if not self.current_campaign or not self.current_encounter:
            return None
        
        template = next(
            (t for t in self.current_campaign.actor_templates if t.id == template_id), None
        )
        if not template:
            return None
        
        new_actor = template.model_copy(update={"id": str(uuid.uuid4())})
        self.current_encounter.actors.append(new_actor)
        return new_actor
    
    # ==================== Initiative Methods ====================
    
    def set_initiative_order(self, actor_ids: List[str]) -> bool:
        """Explicitly set (or reorder) the initiative order. GM-controlled, no dice rolled.
        
        Any current-encounter actor missing from actor_ids is appended at the end,
        preserving its relative order, so a newly-added actor is never silently dropped.
        """
        if not self.current_encounter:
            return False
        
        valid_ids = {a.id for a in self.current_encounter.actors}
        ordered = [aid for aid in actor_ids if aid in valid_ids]
        missing = [aid for aid in self.current_encounter.initiative_order if aid in valid_ids and aid not in ordered]
        remaining = [aid for aid in valid_ids if aid not in ordered and aid not in missing]
        self.current_encounter.initiative_order = ordered + missing + remaining
        
        if self.current_encounter.current_round == 0:
            self.current_encounter.current_round = 1
            self.current_encounter.current_turn_index = 0
        
        return True
    
    def roll_initiative(self) -> bool:
        """Roll initiative for all actors in current encounter."""
        if not self.current_encounter or not self.current_encounter.actors:
            return False
        
        import random
        
        initiative_rolls = []
        for actor in self.current_encounter.actors:
            roll = random.randint(1, 20) + actor.initiative_bonus
            initiative_rolls.append((actor.id, roll))
        
        # Sort by roll descending
        initiative_rolls.sort(key=lambda x: x[1], reverse=True)
        self.current_encounter.initiative_order = [actor_id for actor_id, _ in initiative_rolls]
        self.current_encounter.current_round = 1
        self.current_encounter.current_turn_index = 0
        
        return True
    
    def next_turn(self) -> Optional[str]:
        """Advance to the next turn. Returns the actor ID of the next actor."""
        if not self.current_encounter or not self.current_encounter.initiative_order:
            return None
        
        self.current_encounter.current_turn_index += 1
        
        # Check if we've completed a round
        if self.current_encounter.current_turn_index >= len(self.current_encounter.initiative_order):
            self.current_encounter.current_turn_index = 0
            self.current_encounter.current_round += 1
            # Decrement effect durations
            self._tick_effects()
        
        return self.current_encounter.initiative_order[self.current_encounter.current_turn_index]
    
    def _tick_effects(self) -> None:
        """Decrement effect durations at the end of each round."""
        if not self.current_encounter:
            return
        
        for actor in self.current_encounter.actors:
            actor.effects = [e for e in actor.effects if e.duration_rounds > 0]
            for effect in actor.effects:
                effect.duration_rounds -= 1
