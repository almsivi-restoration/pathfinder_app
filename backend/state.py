"""
In-memory state manager for campaigns and scenes.
Handles CRUD operations and persistence.
"""

import base64
import binascii
import json
import logging
import os
import re
import shutil
import tempfile
from typing import Dict, List, Optional
from pathlib import Path
from datetime import datetime
from models import CUSTOM_STAMP_MAX_BYTES, Campaign, Scene, Actor, ChronicleEntry, CustomStamp, Venue
from rules import get_ruleset
from rules.common import get_sheet_value
import uuid


CAMPAIGN_EXPORT_FORMAT = "gm-workbench-campaign"
CAMPAIGN_EXPORT_VERSION = 4  # 2 added venues, 3 custom stamps, 4 venue nesting; older bundles still import
_SCENE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
_VENUE_ID_PATTERN = _SCENE_ID_PATTERN
_STAMP_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_STAMP_EXTENSIONS = {"image/png": "png", "image/svg+xml": "svg"}
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
# Edge kinds drawn as something else on the Venue Screen, so players cannot spot them.
_PLAYER_EDGE_DISGUISES = {"secret_door": "wall"}

logger = logging.getLogger(__name__)


def player_venue_view(venue: Venue) -> dict:
    """Return the players' copy of a venue: no GM notes, no GM-only features, and secret
    doors drawn as plain walls. Stripping happens here so hidden content never leaves the server."""
    return {
        "id": venue.id,
        "name": venue.name,
        "grid": venue.grid,
        "width": venue.width,
        "height": venue.height,
        "cells": dict(venue.cells),
        "edges": [
            {**edge.model_dump(), "kind": _PLAYER_EDGE_DISGUISES.get(edge.kind, edge.kind)}
            for edge in venue.edges
        ],
        "features": [
            feature.model_dump(exclude={"target_venue_id"}) for feature in venue.features if not feature.gm_only
        ],
        "updated_at": venue.updated_at.isoformat(),
    }


def sniff_stamp_image(data: bytes) -> str:
    """Return the media type of an acceptable stamp image, or raise ValueError.

    Only PNG and SVG are accepted, judged by content rather than by file name. SVGs are only
    ever drawn through an image element, where browsers run no scripts; DTDs are refused anyway."""
    if not data:
        raise ValueError("The image is empty")
    if len(data) > CUSTOM_STAMP_MAX_BYTES:
        raise ValueError(f"Stamp images must be {CUSTOM_STAMP_MAX_BYTES // 1024} KB or smaller")
    if data.startswith(_PNG_SIGNATURE):
        return "image/png"
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = ""
    if "<svg" in text and "<!DOCTYPE" not in text.upper() and "<!ENTITY" not in text.upper():
        return "image/svg+xml"
    raise ValueError("Choose a PNG or SVG image")


def _top_level_broken_parents(venues: List[Venue]) -> List[Venue]:
    """Move venues whose parent is missing from the set, or who sit in a parent cycle, to the
    top level, so an imported bundle never carries a nesting the editor could not make."""
    parents = {venue.id: venue.parent_id for venue in venues}
    broken = set()
    for venue in venues:
        seen = {venue.id}
        parent_id = venue.parent_id
        while parent_id:
            if parent_id not in parents or parent_id in seen:
                broken.add(venue.id)
                break
            seen.add(parent_id)
            parent_id = parents[parent_id]
    return [venue.model_copy(update={"parent_id": None}) if venue.id in broken else venue for venue in venues]


def _validate_campaign_name(name: str) -> str:
    """Return the trimmed name, or raise if it cannot be a campaign folder on any platform."""
    name = name.strip()
    if (
        not name or name in {".", ".."} or name.endswith(".")
        or any(character in '<>:"/\\|?*' or ord(character) < 32 for character in name)
        or name.split(".")[0].upper() in {
            "CON", "PRN", "AUX", "NUL",
            *{f"COM{number}" for number in range(1, 10)},
            *{f"LPT{number}" for number in range(1, 10)},
        }
    ):
        raise ValueError("Enter a valid campaign name")
    return name


class StateManager:
    def __init__(self, campaigns_dir: str = "./campaigns"):
        self.campaigns_dir = Path(campaigns_dir)
        self.campaigns_dir.mkdir(exist_ok=True)
        
        # In-memory state
        self.current_campaign: Optional[Campaign] = None
        self.current_scene: Optional[Scene] = None
        self.scenes: Dict[str, Scene] = {}
        self.campaigns: Dict[str, Campaign] = {}
        self.shown_venue_id: Optional[str] = None  # venue on the Venue Screen; in-memory only
    
    # ==================== Campaign Methods ====================
    
    def create_campaign(self, name: str, ruleset: str) -> Campaign:
        """Create a new campaign."""
        if not get_ruleset(ruleset):
            raise ValueError("Ruleset not found")
        campaign = Campaign(name=name, ruleset=ruleset)
        self.campaigns[campaign.name] = campaign
        self.current_campaign = campaign
        self.shown_venue_id = None
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
        self.shown_venue_id = None
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
        return [d.name for d in self.campaigns_dir.iterdir() if d.is_dir() and not d.name.startswith(".import-")]

    def rename_campaign(self, campaign_name: str, new_name: str) -> Optional[Campaign]:
        """Rename a saved campaign without changing its scenes or unsaved edits."""
        new_name = _validate_campaign_name(new_name)
        campaign_dir = self._saved_campaign_dir(campaign_name)
        if not campaign_dir:
            return None
        target_dir = self.campaigns_dir / new_name
        if new_name != campaign_name and (target_dir.exists() or new_name in self.campaigns):
            raise ValueError("A campaign with that name already exists")
        with open(campaign_dir / "campaign.json", "r") as campaign_file:
            campaign = Campaign(**json.load(campaign_file))
        if new_name == campaign_name:
            return campaign
        campaign.name = new_name
        campaign_dir.rename(target_dir)
        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", dir=target_dir, delete=False) as campaign_file:
                temporary_path = Path(campaign_file.name)
                json.dump(campaign.model_dump(), campaign_file, indent=2, default=str)
            os.replace(temporary_path, target_dir / "campaign.json")
        except OSError:
            if temporary_path:
                temporary_path.unlink(missing_ok=True)
            target_dir.rename(campaign_dir)
            raise
        cached_campaign = self.campaigns.pop(campaign_name, None)
        if cached_campaign:
            cached_campaign.name = new_name
        self.campaigns[new_name] = cached_campaign or campaign
        if self.current_campaign and self.current_campaign.name == campaign_name:
            self.current_campaign.name = new_name
        return campaign

    def _saved_campaign_dir(self, campaign_name: str) -> Optional[Path]:
        """Return a saved campaign's directory only if it sits directly inside campaigns_dir."""
        campaign_dir = self.campaigns_dir / campaign_name
        if (
            campaign_name in {"", ".", ".."} or "/" in campaign_name or "\\" in campaign_name
            or campaign_dir.is_symlink()
            or campaign_dir.resolve().parent != self.campaigns_dir.resolve()
            or not (campaign_dir / "campaign.json").is_file()
        ):
            return None
        return campaign_dir

    def export_campaign(self, campaign_name: str) -> Optional[dict]:
        """Bundle a saved campaign and its saved scenes into one portable JSON document."""
        campaign_dir = self._saved_campaign_dir(campaign_name)
        if not campaign_dir:
            return None
        with open(campaign_dir / "campaign.json", "r") as campaign_file:
            campaign = Campaign(**json.load(campaign_file))
        scenes = []
        for scene_id in campaign.scenes:
            if not _SCENE_ID_PATTERN.match(scene_id):
                continue
            scene_path = campaign_dir / "scenes" / f"{scene_id}.json"
            if not scene_path.is_file():
                scene_path = campaign_dir / "encounters" / f"{scene_id}.json"
            if scene_path.is_file():
                with open(scene_path, "r") as scene_file:
                    scenes.append(Scene(**json.load(scene_file)))
        campaign.scenes = [scene.id for scene in scenes]
        venues = []
        for venue_path in sorted((campaign_dir / "venues").glob("*.json")):
            if _VENUE_ID_PATTERN.match(venue_path.stem):
                with open(venue_path, "r") as venue_file:
                    venues.append(Venue(**json.load(venue_file)))
        stamps = []
        for stamp, image_path in self._read_custom_stamps(campaign_dir / "stamps"):
            stamps.append({
                **stamp.model_dump(mode="json"),
                "data": base64.b64encode(image_path.read_bytes()).decode("ascii"),
            })
        return {
            "format": CAMPAIGN_EXPORT_FORMAT,
            "version": CAMPAIGN_EXPORT_VERSION,
            "exported_at": datetime.now().isoformat(),
            "campaign": campaign.model_dump(mode="json"),
            "scenes": [scene.model_dump(mode="json") for scene in scenes],
            "venues": [venue.model_dump(mode="json") for venue in venues],
            "stamps": stamps,
        }

    def import_campaign(self, bundle: dict) -> Campaign:
        """Persist an exported campaign bundle as a new saved campaign under a free name."""
        if not isinstance(bundle, dict) or bundle.get("format") != CAMPAIGN_EXPORT_FORMAT:
            raise ValueError("That file is not a Game Masters Workbench campaign export")
        version = bundle.get("version")
        if not isinstance(version, int) or version < 1:
            raise ValueError("The campaign export has no valid version")
        if version > CAMPAIGN_EXPORT_VERSION:
            raise ValueError("The campaign export was made by a newer version of the app")
        try:
            campaign = Campaign(**bundle["campaign"])
            scenes = [Scene(**scene) for scene in bundle.get("scenes", [])]
            venues = [Venue(**venue) for venue in bundle.get("venues", [])]
            stamps = []
            for entry in bundle.get("stamps", []):
                data = base64.b64decode(entry["data"], validate=True)
                stamp = CustomStamp(**{key: value for key, value in entry.items() if key != "data"})
                if sniff_stamp_image(data) != stamp.media_type:
                    raise ValueError("stamp image does not match its media type")
                stamps.append((stamp, data))
        except (KeyError, TypeError, ValueError, binascii.Error):
            raise ValueError("The campaign export is damaged or incomplete")
        if not get_ruleset(campaign.ruleset):
            raise ValueError(f"The campaign uses an unknown ruleset: {campaign.ruleset}")
        scene_ids = [scene.id for scene in scenes]
        if len(set(scene_ids)) != len(scene_ids) or not all(_SCENE_ID_PATTERN.match(i) for i in scene_ids):
            raise ValueError("The campaign export has invalid scene identifiers")
        venue_ids = [venue.id for venue in venues]
        if len(set(venue_ids)) != len(venue_ids) or not all(_VENUE_ID_PATTERN.match(i) for i in venue_ids):
            raise ValueError("The campaign export has invalid venue identifiers")
        venues = _top_level_broken_parents(venues)
        stamp_ids = [stamp.id for stamp, _ in stamps]
        if len(set(stamp_ids)) != len(stamp_ids):
            raise ValueError("The campaign export has invalid stamp identifiers")

        base_name = _validate_campaign_name(campaign.name)
        name = base_name
        suffix = 0
        while (self.campaigns_dir / name).exists() or name in self.campaigns:
            suffix += 1
            name = f"{base_name} (imported)" if suffix == 1 else f"{base_name} (imported {suffix})"
        campaign.name = name
        campaign.scenes = scene_ids

        staging_dir = Path(tempfile.mkdtemp(prefix=".import-", dir=self.campaigns_dir))
        try:
            (staging_dir / "scenes").mkdir()
            for scene in scenes:
                with open(staging_dir / "scenes" / f"{scene.id}.json", "w") as scene_file:
                    json.dump(scene.model_dump(), scene_file, indent=2, default=str)
            (staging_dir / "venues").mkdir()
            for venue in venues:
                with open(staging_dir / "venues" / f"{venue.id}.json", "w") as venue_file:
                    json.dump(venue.model_dump(), venue_file, indent=2, default=str)
            (staging_dir / "stamps").mkdir()
            for stamp, data in stamps:
                (staging_dir / "stamps" / f"{stamp.id}.{_STAMP_EXTENSIONS[stamp.media_type]}").write_bytes(data)
                with open(staging_dir / "stamps" / f"{stamp.id}.json", "w") as stamp_file:
                    json.dump(stamp.model_dump(), stamp_file, indent=2, default=str)
            with open(staging_dir / "campaign.json", "w") as campaign_file:
                json.dump(campaign.model_dump(), campaign_file, indent=2, default=str)
            staging_dir.rename(self.campaigns_dir / name)
        except OSError:
            shutil.rmtree(staging_dir, ignore_errors=True)
            raise
        return campaign

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
            self.shown_venue_id = None
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

    # ==================== Venue Methods ====================
    # Each venue is its own file under campaigns/<name>/venues/; the folder is the index, so
    # venue edits never rewrite campaign.json (unlike scenes, which campaign.scenes lists).

    def _venue_path(self, venue_id: str) -> Optional[Path]:
        """Return a venue file path in the current campaign, or None for no campaign / unsafe id."""
        if not self.current_campaign or not _VENUE_ID_PATTERN.match(venue_id):
            return None
        return self.campaigns_dir / self.current_campaign.name / "venues" / f"{venue_id}.json"

    def _write_venue(self, venue: Venue) -> None:
        """Atomically replace a venue file so a crash mid-write never leaves a torn map."""
        venue_path = self._venue_path(venue.id)
        venue_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", dir=venue_path.parent, suffix=".tmp", delete=False) as venue_file:
                temporary_path = Path(venue_file.name)
                json.dump(venue.model_dump(), venue_file, indent=2, default=str)
            os.replace(temporary_path, venue_path)
        except OSError:
            if temporary_path:
                temporary_path.unlink(missing_ok=True)
            raise

    def list_venues(self) -> List[Venue]:
        """Return the current campaign's venues, sorted by name; unreadable files are skipped and logged."""
        if not self.current_campaign:
            return []
        venues_dir = self.campaigns_dir / self.current_campaign.name / "venues"
        venues = []
        for venue_path in venues_dir.glob("*.json"):
            if not _VENUE_ID_PATTERN.match(venue_path.stem):
                continue
            try:
                with open(venue_path, "r") as venue_file:
                    venues.append(Venue(**json.load(venue_file)))
            except (OSError, ValueError) as error:
                logger.warning("Skipping unreadable venue %s: %s", venue_path, error)
        return sorted(venues, key=lambda venue: (venue.name.lower(), venue.created_at))

    def _check_parent(self, venue_id: str, parent_id: Optional[str]) -> None:
        """Raise ValueError unless parent_id is empty or an existing venue that does not sit,
        at any depth, inside venue_id."""
        seen = {venue_id}
        while parent_id:
            if parent_id in seen:
                raise ValueError("A venue cannot sit inside one of its own rooms")
            seen.add(parent_id)
            parent = self.get_venue(parent_id)
            if not parent:
                raise ValueError("The venue it sits inside no longer exists")
            parent_id = parent.parent_id

    def create_venue(self, name: str, width: int, height: int, parent_id: Optional[str] = None) -> Optional[Venue]:
        """Create and persist an empty venue on the current campaign, optionally inside another."""
        if not self.current_campaign:
            return None
        venue = Venue(id=str(uuid.uuid4()), name=name, width=width, height=height, parent_id=parent_id)
        self._check_parent(venue.id, parent_id)
        self._write_venue(venue)
        return venue

    def get_venue(self, venue_id: str) -> Optional[Venue]:
        """Read one venue of the current campaign from disk."""
        venue_path = self._venue_path(venue_id)
        if not venue_path or not venue_path.is_file():
            return None
        with open(venue_path, "r") as venue_file:
            return Venue(**json.load(venue_file))

    def update_venue(self, venue_id: str, venue: Venue) -> Optional[Venue]:
        """Replace a saved venue's contents, keeping its id and creation time."""
        existing = self.get_venue(venue_id)
        if not existing:
            return None
        # A parent deleted while this room was open in the editor lifts it to the top level,
        # as delete_venue does for saved rooms; a cycle is still refused.
        if venue.parent_id and not self.get_venue(venue.parent_id):
            venue = venue.model_copy(update={"parent_id": None})
        self._check_parent(venue_id, venue.parent_id)
        updated = venue.model_copy(update={
            "id": venue_id,
            "created_at": existing.created_at,
            "updated_at": datetime.now(),
        })
        self._write_venue(updated)
        return updated

    def delete_venue(self, venue_id: str) -> bool:
        """Delete one venue; it also leaves the Venue Screen if it was shown."""
        venue_path = self._venue_path(venue_id)
        if not venue_path or not venue_path.is_file():
            return False
        venue_path.unlink()
        if self.shown_venue_id == venue_id:
            self.shown_venue_id = None
        # Its rooms move up to the top level; passages that led here stay, as dead ends.
        for child in self.list_venues():
            if child.parent_id == venue_id:
                self._write_venue(child.model_copy(update={"parent_id": None}))
        return True

    def show_venue(self, venue_id: str) -> Optional[Venue]:
        """Put a venue on the Venue Screen."""
        venue = self.get_venue(venue_id)
        if venue:
            self.shown_venue_id = venue_id
        return venue

    def hide_venue(self) -> None:
        """Clear the Venue Screen."""
        self.shown_venue_id = None

    def shown_venue_view(self) -> Optional[dict]:
        """Return the player-safe projection of the shown venue, read fresh so saves appear live."""
        if not self.shown_venue_id:
            return None
        try:
            venue = self.get_venue(self.shown_venue_id)
        except (OSError, ValueError) as error:
            logger.warning("Shown venue %s is unreadable: %s", self.shown_venue_id, error)
            return None
        return player_venue_view(venue) if venue else None

    # ==================== Custom Stamp Methods ====================
    # A custom stamp is <id>.json (its CustomStamp record) plus <id>.png or <id>.svg under
    # campaigns/<name>/stamps/; like venues, the folder is the index.

    def _stamps_dir(self) -> Optional[Path]:
        if not self.current_campaign:
            return None
        return self.campaigns_dir / self.current_campaign.name / "stamps"

    @staticmethod
    def _read_custom_stamps(stamps_dir: Path) -> List[tuple]:
        """Return (stamp, image path) pairs for every readable stamp in a folder."""
        stamps = []
        for record_path in sorted(stamps_dir.glob("*.json")):
            if not _STAMP_ID_PATTERN.match(record_path.stem):
                continue
            try:
                with open(record_path, "r") as record_file:
                    stamp = CustomStamp(**json.load(record_file))
            except (OSError, ValueError) as error:
                logger.warning("Skipping unreadable custom stamp %s: %s", record_path, error)
                continue
            image_path = stamps_dir / f"{stamp.id}.{_STAMP_EXTENSIONS[stamp.media_type]}"
            if stamp.id == record_path.stem and image_path.is_file():
                stamps.append((stamp, image_path))
        return stamps

    def list_custom_stamps(self) -> List[CustomStamp]:
        stamps_dir = self._stamps_dir()
        if not stamps_dir:
            return []
        stamps = [stamp for stamp, _ in self._read_custom_stamps(stamps_dir)]
        return sorted(stamps, key=lambda stamp: (stamp.name.lower(), stamp.created_at))

    def _write_stamp_record(self, stamp: CustomStamp) -> None:
        record_path = self._stamps_dir() / f"{stamp.id}.json"
        temporary_path = record_path.with_suffix(".json.tmp")
        with open(temporary_path, "w") as record_file:
            json.dump(stamp.model_dump(), record_file, indent=2, default=str)
        os.replace(temporary_path, record_path)

    def create_custom_stamp(self, name: str, mat_glyph: str, data: bytes) -> Optional[CustomStamp]:
        """Store an imported image as a new stamp; raises ValueError for an unacceptable image."""
        stamps_dir = self._stamps_dir()
        if not stamps_dir:
            return None
        media_type = sniff_stamp_image(data)
        stamp = CustomStamp(id=str(uuid.uuid4()), name=name, mat_glyph=mat_glyph, media_type=media_type)
        stamps_dir.mkdir(parents=True, exist_ok=True)
        (stamps_dir / f"{stamp.id}.{_STAMP_EXTENSIONS[media_type]}").write_bytes(data)
        self._write_stamp_record(stamp)
        return stamp

    def _custom_stamp_entry(self, stamp_id: str) -> Optional[tuple]:
        stamps_dir = self._stamps_dir()
        if not stamps_dir or not _STAMP_ID_PATTERN.match(stamp_id):
            return None
        return next((entry for entry in self._read_custom_stamps(stamps_dir) if entry[0].id == stamp_id), None)

    def custom_stamp_image(self, stamp_id: str) -> Optional[tuple]:
        """Return (image path, media type) for one stamp of the current campaign."""
        entry = self._custom_stamp_entry(stamp_id)
        return (entry[1], entry[0].media_type) if entry else None

    def update_custom_stamp(self, stamp_id: str, name: str, mat_glyph: str) -> Optional[CustomStamp]:
        entry = self._custom_stamp_entry(stamp_id)
        if not entry:
            return None
        updated = entry[0].model_copy(update={"name": name, "mat_glyph": mat_glyph})
        self._write_stamp_record(updated)
        return updated

    def delete_custom_stamp(self, stamp_id: str) -> bool:
        """Delete a stamp; venue features that used it keep their place and draw a placeholder."""
        entry = self._custom_stamp_entry(stamp_id)
        if not entry:
            return False
        stamp, image_path = entry
        (self._stamps_dir() / f"{stamp.id}.json").unlink()
        image_path.unlink(missing_ok=True)
        return True

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
