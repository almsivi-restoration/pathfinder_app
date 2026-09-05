"""Regression tests for StateManager - the core CRUD/initiative/template logic.

Each test uses an isolated temp-directory-backed StateManager (see conftest.py) so nothing
here ever touches the real backend/campaigns/ save data.
"""

from models import Actor, Effect
import uuid


def make_actor(actor_id=None, name="Goblin", is_pc=False):
    # StateManager.add_actor() does not assign an id itself (that's the API layer's job in
    # main.py, via uuid4() before calling add_actor) - unit tests must assign one explicitly
    # or every actor silently collides on id="".
    return Actor(
        id=actor_id or str(uuid.uuid4()),
        name=name,
        is_pc=is_pc,
        sheet={"initiative": {"bonus": 2}},
    )


def test_create_save_and_load_campaign(state_manager, tmp_path):
    campaign = state_manager.create_campaign("Test Campaign", "1e")
    assert campaign.name == "Test Campaign"
    assert state_manager.current_campaign is campaign

    assert state_manager.save_campaign() is True
    saved_path = tmp_path / "campaigns" / "Test Campaign" / "campaign.json"
    assert saved_path.exists()

    # simulate a fresh process picking the campaign back up from disk
    state_manager.current_campaign = None
    loaded = state_manager.load_campaign("Test Campaign")
    assert loaded is not None
    assert loaded.name == "Test Campaign"
    assert loaded.ruleset == "1e"


def test_load_missing_campaign_returns_none(state_manager):
    assert state_manager.load_campaign("does-not-exist") is None


def test_delete_campaign_removes_only_the_selected_campaign(state_manager):
    state_manager.create_campaign("Keep", "1e")
    state_manager.save_campaign()
    state_manager.create_campaign("Remove", "1e")
    state_manager.save_campaign()

    assert state_manager.delete_campaign("Remove") is True
    assert state_manager.list_campaigns() == ["Keep"]
    assert state_manager.current_campaign is None
    assert state_manager.delete_campaign("../Keep") is False


def test_create_encounter_registers_on_campaign(state_manager):
    state_manager.create_campaign("Camp", "1e")
    encounter = state_manager.create_encounter("Goblin Ambush")
    assert encounter.id in state_manager.current_campaign.encounters
    assert state_manager.current_encounter is encounter
    assert not hasattr(encounter, "ruleset")


def test_list_close_and_delete_encounter(state_manager):
    state_manager.create_campaign("Camp", "1e")
    encounter = state_manager.create_encounter("Fight")
    assert state_manager.save_encounter() is True

    assert [item.id for item in state_manager.list_encounters()] == [encounter.id]
    assert state_manager.close_encounter() is True
    assert state_manager.current_encounter is None
    assert [item.id for item in state_manager.list_encounters()] == [encounter.id]
    assert state_manager.current_encounter is None
    assert state_manager.delete_encounter(encounter.id) is True
    assert state_manager.list_encounters() == []


def test_closing_an_unsaved_encounter_discards_its_campaign_reference(state_manager):
    campaign = state_manager.create_campaign("Camp", "1e")
    encounter = state_manager.create_encounter("Unsaved Fight")

    assert state_manager.close_encounter() is True
    assert encounter.id not in campaign.encounters


def test_loading_campaign_clears_encounter_from_the_previous_campaign(state_manager):
    first_campaign = state_manager.create_campaign("First", "1e")
    state_manager.save_campaign(first_campaign)
    state_manager.create_encounter("First Fight")
    state_manager.create_campaign("Second", "1e")
    state_manager.save_campaign()

    state_manager.load_campaign("First")

    assert state_manager.current_encounter is None


def test_add_update_remove_actor(state_manager):
    state_manager.create_campaign("Camp", "1e")
    state_manager.create_encounter("Fight")

    actor = make_actor()
    assert state_manager.add_actor(actor) is True
    assert len(state_manager.current_encounter.actors) == 1

    actor.sheet["hp"] = {"current": 5}
    assert state_manager.update_actor(actor.id, actor) is True
    assert state_manager.get_actor(actor.id).sheet["hp"]["current"] == 5

    assert state_manager.remove_actor(actor.id) is True
    assert state_manager.get_actor(actor.id) is None


def test_remove_actor_clears_it_from_initiative_order(state_manager):
    state_manager.create_campaign("Camp", "1e")
    state_manager.create_encounter("Fight")
    actor = make_actor()
    state_manager.add_actor(actor)
    state_manager.current_encounter.initiative_order = [actor.id]

    state_manager.remove_actor(actor.id)
    assert actor.id not in state_manager.current_encounter.initiative_order
    assert state_manager.remove_actor(actor.id) is False


def test_roll_initiative_orders_all_actors_and_starts_round_1(state_manager):
    state_manager.create_campaign("Camp", "1e")
    state_manager.create_encounter("Fight")
    a1, a2 = make_actor(name="A"), make_actor(name="B")
    state_manager.add_actor(a1)
    state_manager.add_actor(a2)

    assert state_manager.roll_initiative() is True
    assert set(state_manager.current_encounter.initiative_order) == {a1.id, a2.id}
    assert state_manager.current_encounter.current_round == 1
    assert state_manager.current_encounter.current_turn_index == 0


def test_set_initiative_order_is_gm_controlled_and_keeps_missing_actors(state_manager):
    state_manager.create_campaign("Camp", "1e")
    state_manager.create_encounter("Fight")
    a1, a2, a3 = make_actor(name="A"), make_actor(name="B"), make_actor(name="C")
    state_manager.add_actor(a1)
    state_manager.add_actor(a2)
    state_manager.add_actor(a3)

    # GM only specifies two of the three actors - the third must not be silently dropped
    assert state_manager.set_initiative_order([a2.id, a1.id]) is True
    order = state_manager.current_encounter.initiative_order
    assert order[:2] == [a2.id, a1.id]
    assert a3.id in order
    assert len(order) == 3
    assert state_manager.current_encounter.current_round == 1


def test_next_turn_advances_round_and_ticks_effects(state_manager):
    state_manager.create_campaign("Camp", "1e")
    state_manager.create_encounter("Fight")
    a1, a2 = make_actor(name="A"), make_actor(name="B")
    a1.effects.append(Effect(name="Poisoned", duration_rounds=1))
    state_manager.add_actor(a1)
    state_manager.add_actor(a2)
    state_manager.current_encounter.initiative_order = [a1.id, a2.id]
    state_manager.current_encounter.current_round = 1
    state_manager.current_encounter.current_turn_index = 0

    next_actor = state_manager.next_turn()
    assert next_actor == a2.id
    assert state_manager.current_encounter.current_round == 1

    # completing the round ticks effect durations down by one (current behavior: an effect
    # is not dropped until the round AFTER it reaches 0 - it lingers with duration_rounds=0
    # for one full round before the next tick's filter removes it).
    next_actor = state_manager.next_turn()
    assert next_actor == a1.id
    assert state_manager.current_encounter.current_round == 2
    remaining_effects = state_manager.get_actor(a1.id).effects
    assert len(remaining_effects) == 1
    assert remaining_effects[0].duration_rounds == 0


def test_actor_template_lifecycle(state_manager):
    state_manager.create_campaign("Camp", "1e")
    state_manager.create_encounter("Fight")

    template = make_actor(name="Goblin Template")
    saved = state_manager.add_actor_template(template)
    assert saved.id != ""
    assert len(state_manager.list_actor_templates()) == 1

    updated = make_actor(actor_id=saved.id, name="Goblin Template (Elite)")
    result = state_manager.update_actor_template(saved.id, updated)
    assert result.name == "Goblin Template (Elite)"

    instantiated = state_manager.instantiate_template(saved.id)
    assert instantiated is not None
    assert instantiated.id != saved.id  # a copy with a fresh id, not the template itself
    assert instantiated in state_manager.current_encounter.actors

    assert state_manager.remove_actor_template(saved.id) is True
    assert state_manager.list_actor_templates() == []


def test_actor_migrates_legacy_pathfinder_fields_into_sheet():
    actor = Actor(
        id="legacy-actor",
        name="Legacy Goblin",
        is_pc=False,
        hp_current=7,
        hp_max=10,
        ac=15,
        initiative_bonus=2,
        speed=30,
        abilities={"str": 10},
        skills={"perception": 4},
        saves={"fort": 3},
        weapons=[{"name": "Spear", "damage_dice": "1d6"}],
    )

    assert actor.sheet["hp"] == {"current": 7, "max": 10}
    assert actor.sheet["defenses"]["ac"] == 15
    assert actor.sheet["weapons"][0]["name"] == "Spear"
    assert actor.sheet["weapons"][0]["damage"] == "1d6"
    assert actor.sheet["skills"] == [{"name": "Perception", "total": 4, "ranks": 0, "misc": 0}]
    assert actor.sheet["saves"][0]["name"] == "Fort"
