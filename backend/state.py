"""
In-memory state manager for campaigns and scenes.
Handles CRUD operations and persistence.
"""

import json
import os
import shutil
from typing import Dict, List, Optional
from pathlib import Path
from datetime import datetime
from models import Campaign, Scene, Actor, ChronicleEntry
from rules import get_ruleset
from rules.common import get_sheet_value
import uuid


class StateManager:
    def __init__(self, campaigns_dir: str = "./campaigns"):
        self.campaigns_dir = Path(campaigns_dir)
        self.campaigns_dir.mkdir(exist_ok=True)
        
        # In-memory state
        self.current_campaign: Optional[Campaign] = None
        self.current_scene: Optional[Scene] = None
        self.scenes: Dict[str, Scene] = {}
        self.campaigns: Dict[str, Campaign] = {}
    
    # ==================== Campaign Methods ====================
    
    def create_campaign(self, name: str, ruleset: str) -> Campaign:
        """Create a new campaign."""
        if not get_ruleset(ruleset):
            raise ValueError("Ruleset not found")
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
        self.current_scene = None
        self.scenes = {}
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

    def delete_campaign(self, campaign_name: str) -> bool:
        """Delete one persisted campaign and clear it if it is currently loaded."""
        campaign_dir = (self.campaigns_dir / campaign_name).resolve()
        if campaign_dir.parent != self.campaigns_dir.resolve() or not campaign_dir.is_dir():
            return False

        shutil.rmtree(campaign_dir)
        self.campaigns.pop(campaign_name, None)
        if self.current_campaign and self.current_campaign.name == campaign_name:
            self.current_campaign = None
            self.current_scene = None
            self.scenes = {}
        return True
    
    # ==================== Scene Methods ====================
    
    def create_scene(self, name: str) -> Scene:
        """Create a new scene."""
        if not self.current_campaign:
            raise ValueError("No campaign loaded")

        scene = Scene(id=str(uuid.uuid4()), name=name)
        self.scenes[scene.id] = scene
        self.current_scene = scene
        self.current_campaign.scenes.append(scene.id)
        
        return scene

    def list_scenes(self) -> List[Scene]:
        """Return the current campaign's scenes from memory or persisted files."""
        if not self.current_campaign:
            return []

        active_scene_id = self.current_scene.id if self.current_scene else None
        scenes = []
        for scene_id in self.current_campaign.scenes:
            scene = self.load_scene(scene_id)
            if scene:
                scenes.append(scene)
        self.current_scene = next(
            (scene for scene in scenes if scene.id == active_scene_id),
            None,
        )
        return scenes

    def close_scene(self) -> bool:
        """Clear the active scene without changing the campaign or saved scene data."""
        if not self.current_scene:
            return False
        scene_path = self.campaigns_dir / self.current_campaign.name / "scenes" / f"{self.current_scene.id}.json"
        legacy_scene_path = self.campaigns_dir / self.current_campaign.name / "encounters" / f"{self.current_scene.id}.json"
        if not scene_path.exists() and not legacy_scene_path.exists():
            self.current_campaign.scenes.remove(self.current_scene.id)
        self.current_scene = None
        return True

    def delete_scene(self, scene_id: str) -> bool:
        """Delete one scene belonging to the current campaign."""
        if not self.current_campaign or scene_id not in self.current_campaign.scenes:
            return False

        scene_path = self.campaigns_dir / self.current_campaign.name / "scenes" / f"{scene_id}.json"
        legacy_scene_path = self.campaigns_dir / self.current_campaign.name / "encounters" / f"{scene_id}.json"
        if scene_path.exists():
            scene_path.unlink()
        elif legacy_scene_path.exists():
            legacy_scene_path.unlink()
        self.current_campaign.scenes.remove(scene_id)
        self.scenes.pop(scene_id, None)
        if self.current_scene and self.current_scene.id == scene_id:
            self.current_scene = None
        self.save_campaign()
        return True
    
    def load_scene(self, scene_id: str) -> Optional[Scene]:
        """Load scene from memory or disk."""
        if scene_id in self.scenes:
            self.current_scene = self.scenes[scene_id]
            return self.current_scene
        
        # Attempt to load from disk
        if self.current_campaign:
            scene_path = self.campaigns_dir / self.current_campaign.name / "scenes" / f"{scene_id}.json"
            legacy_scene_path = self.campaigns_dir / self.current_campaign.name / "encounters" / f"{scene_id}.json"
            if not scene_path.exists():
                scene_path = legacy_scene_path
            if scene_path.exists():
                with open(scene_path, "r") as f:
                    data = json.load(f)
                    scene = Scene(**data)
                    self.scenes[scene_id] = scene
                    self.current_scene = scene
                    return scene
        
        return None
    
    def save_scene(self, scene: Optional[Scene] = None) -> bool:
        """Persist scene to disk."""
        scene = scene or self.current_scene
        if not scene or not self.current_campaign:
            return False
        
        scenes_dir = self.campaigns_dir / self.current_campaign.name / "scenes"
        scenes_dir.mkdir(parents=True, exist_ok=True)
        
        scene_path = scenes_dir / f"{scene.id}.json"
        with open(scene_path, "w") as f:
            json.dump(scene.model_dump(), f, indent=2, default=str)
        
        return True
    
    # ==================== Actor Methods ====================
    
    def add_actor(self, actor: Actor) -> bool:
        """Add actor to current scene."""
        if not self.current_scene:
            return False
        
        self.current_scene.actors.append(actor)
        return True
    
    def remove_actor(self, actor_id: str) -> bool:
        """Remove actor from current scene."""
        if not self.current_scene:
            return False
        
        original_count = len(self.current_scene.actors)
        self.current_scene.actors = [a for a in self.current_scene.actors if a.id != actor_id]
        if len(self.current_scene.actors) == original_count:
            return False
        # Remove from initiative order if present
        if actor_id in self.current_scene.initiative_order:
            self.current_scene.initiative_order.remove(actor_id)
        
        return True
    
    def update_actor(self, actor_id: str, updated_actor: Actor) -> bool:
        """Update an actor in the current scene."""
        if not self.current_scene:
            return False
        
        for i, actor in enumerate(self.current_scene.actors):
            if actor.id == actor_id:
                self.current_scene.actors[i] = updated_actor
                return True
        
        return False
    
    def get_actor(self, actor_id: str) -> Optional[Actor]:
        """Retrieve actor by ID from current scene."""
        if not self.current_scene:
            return None
        
        for actor in self.current_scene.actors:
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
        """Copy a campaign actor template into the current scene as a new actor."""
        if not self.current_campaign or not self.current_scene:
            return None
        
        template = next(
            (t for t in self.current_campaign.actor_templates if t.id == template_id), None
        )
        if not template:
            return None
        
        new_actor = template.model_copy(update={"id": str(uuid.uuid4())})
        self.current_scene.actors.append(new_actor)
        return new_actor

    # ==================== Chronicle Methods ====================

    def add_chronicle_entry(self, title: str, body: str) -> Optional[ChronicleEntry]:
        """Append a journal entry to the current campaign's chronicle and persist it."""
        if not self.current_campaign:
            return None

        entry = ChronicleEntry(id=str(uuid.uuid4()), title=title, body=body)
        self.current_campaign.chronicle.append(entry)
        self.save_campaign()
        return entry

    def list_chronicle_entries(self) -> List[ChronicleEntry]:
        """List the current campaign's chronicle entries, oldest first."""
        if not self.current_campaign:
            return []
        return self.current_campaign.chronicle

    def update_chronicle_entry(self, entry_id: str, title: str, body: str) -> Optional[ChronicleEntry]:
        """Update a chronicle entry on the current campaign and persist it."""
        if not self.current_campaign:
            return None

        for i, entry in enumerate(self.current_campaign.chronicle):
            if entry.id == entry_id:
                self.current_campaign.chronicle[i] = entry.model_copy(
                    update={"title": title, "body": body, "updated_at": datetime.now()}
                )
                self.save_campaign()
                return self.current_campaign.chronicle[i]

        return None

    def remove_chronicle_entry(self, entry_id: str) -> bool:
        """Remove a chronicle entry from the current campaign and persist the removal."""
        if not self.current_campaign:
            return False

        original_count = len(self.current_campaign.chronicle)
        self.current_campaign.chronicle = [
            e for e in self.current_campaign.chronicle if e.id != entry_id
        ]
        removed = len(self.current_campaign.chronicle) != original_count
        if removed:
            self.save_campaign()
        return removed

    # ==================== Initiative Methods ====================
    
    def set_initiative_order(self, actor_ids: List[str]) -> bool:
        """Explicitly set (or reorder) the initiative order. GM-controlled, no dice rolled.
        
        Any current-scene actor missing from actor_ids is appended at the end,
        preserving its relative order, so a newly-added actor is never silently dropped.
        """
        if not self.current_scene:
            return False
        
        valid_ids = {a.id for a in self.current_scene.actors}
        ordered = [aid for aid in actor_ids if aid in valid_ids]
        missing = [aid for aid in self.current_scene.initiative_order if aid in valid_ids and aid not in ordered]
        remaining = [aid for aid in valid_ids if aid not in ordered and aid not in missing]
        self.current_scene.initiative_order = ordered + missing + remaining
        
        if self.current_scene.current_round == 0:
            self.current_scene.current_round = 1
            self.current_scene.current_turn_index = 0
        
        return True
    
    def roll_initiative(self) -> bool:
        """Roll initiative for all actors in current scene."""
        if not self.current_scene or not self.current_scene.actors:
            return False
        
        import random
        
        initiative_rolls = []
        ruleset = get_ruleset(self.current_campaign.ruleset) if self.current_campaign else None
        bonus_key = ruleset.get("actor_sheet", {}).get("initiative", {}).get("bonus_key") if ruleset else None
        for actor in self.current_scene.actors:
            bonus = get_sheet_value(actor.sheet, bonus_key, 0) if bonus_key else 0
            roll = random.randint(1, 20) + bonus
            initiative_rolls.append((actor.id, roll))
        
        # Sort by roll descending
        initiative_rolls.sort(key=lambda x: x[1], reverse=True)
        self.current_scene.initiative_order = [actor_id for actor_id, _ in initiative_rolls]
        self.current_scene.current_round = 1
        self.current_scene.current_turn_index = 0
        
        return True
    
    def next_turn(self) -> Optional[str]:
        """Advance to the next turn. Returns the actor ID of the next actor."""
        if not self.current_scene or not self.current_scene.initiative_order:
            return None
        
        self.current_scene.current_turn_index += 1
        
        # Check if we've completed a round
        if self.current_scene.current_turn_index >= len(self.current_scene.initiative_order):
            self.current_scene.current_turn_index = 0
            self.current_scene.current_round += 1
            # Decrement effect durations
            self._tick_effects()
        
        return self.current_scene.initiative_order[self.current_scene.current_turn_index]
    
    def _tick_effects(self) -> None:
        """Decrement effect durations at the end of each round."""
        if not self.current_scene:
            return
        
        for actor in self.current_scene.actors:
            actor.effects = [e for e in actor.effects if e.duration_rounds > 0]
            for effect in actor.effects:
                effect.duration_rounds -= 1
