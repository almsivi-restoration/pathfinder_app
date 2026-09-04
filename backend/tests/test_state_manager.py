"""Regression tests for StateManager - the core CRUD/initiative/template logic.

Each test uses an isolated temp-directory-backed StateManager (see conftest.py) so nothing
here ever touches the real backend/campaigns/ save data.
"""

from models import Actor, Effect, Ruleset
import uuid


def make_actor(actor_id=None, name="Goblin", is_pc=False):
    # StateManager.add_actor() does not assign an id itself (that's the API layer's job in
    # main.py, via uuid4() before calling add_actor) - unit tests must assign one explicitly
    # or every actor silently collides on id="".
    return Actor(
        id=actor_id or str(uuid.uuid4()),
        name=name,
        ruleset=Ruleset.PATHFINDER_1E,
        is_pc=is_pc,
        hp_current=10,
        hp_max=10,
        ac=12,
        initiative_bonus=2,
        speed=30,
        abilities={"str": 10, "dex": 12, "con": 10, "int": 10, "wis": 10, "cha": 10},
    )


def test_create_save_and_load_campaign(state_manager, tmp_path):
    campaign = state_manager.create_campaign("Test Campaign", Ruleset.PATHFINDER_1E)
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
    assert loaded.ruleset == Ruleset.PATHFINDER_1E


def test_load_missing_campaign_returns_none(state_manager):
    assert state_manager.load_campaign("does-not-exist") is None


def test_create_encounter_registers_on_campaign(state_manager):
    state_manager.create_campaign("Camp", Ruleset.PATHFINDER_1E)
    encounter = state_manager.create_encounter("Goblin Ambush", Ruleset.PATHFINDER_1E)
    assert encounter.id in state_manager.current_campaign.encounters
    assert state_manager.current_encounter is encounter


def test_add_update_remove_actor(state_manager):
    state_manager.create_campaign("Camp", Ruleset.PATHFINDER_1E)
    state_manager.create_encounter("Fight", Ruleset.PATHFINDER_1E)

    actor = make_actor()
    assert state_manager.add_actor(actor) is True
    assert len(state_manager.current_encounter.actors) == 1

    actor.hp_current = 5
    assert state_manager.update_actor(actor.id, actor) is True
    assert state_manager.get_actor(actor.id).hp_current == 5

    assert state_manager.remove_actor(actor.id) is True
    assert state_manager.get_actor(actor.id) is None


def test_remove_actor_clears_it_from_initiative_order(state_manager):
    state_manager.create_campaign("Camp", Ruleset.PATHFINDER_1E)
    state_manager.create_encounter("Fight", Ruleset.PATHFINDER_1E)
    actor = make_actor()
    state_manager.add_actor(actor)
    state_manager.current_encounter.initiative_order = [actor.id]

    state_manager.remove_actor(actor.id)
    assert actor.id not in state_manager.current_encounter.initiative_order


def test_roll_initiative_orders_all_actors_and_starts_round_1(state_manager):
    state_manager.create_campaign("Camp", Ruleset.PATHFINDER_1E)
    state_manager.create_encounter("Fight", Ruleset.PATHFINDER_1E)
    a1, a2 = make_actor(name="A"), make_actor(name="B")
    state_manager.add_actor(a1)
    state_manager.add_actor(a2)

    assert state_manager.roll_initiative() is True
    assert set(state_manager.current_encounter.initiative_order) == {a1.id, a2.id}
    assert state_manager.current_encounter.current_round == 1
    assert state_manager.current_encounter.current_turn_index == 0


def test_set_initiative_order_is_gm_controlled_and_keeps_missing_actors(state_manager):
    state_manager.create_campaign("Camp", Ruleset.PATHFINDER_1E)
    state_manager.create_encounter("Fight", Ruleset.PATHFINDER_1E)
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
    state_manager.create_campaign("Camp", Ruleset.PATHFINDER_1E)
    state_manager.create_encounter("Fight", Ruleset.PATHFINDER_1E)
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
    state_manager.create_campaign("Camp", Ruleset.PATHFINDER_1E)
    state_manager.create_encounter("Fight", Ruleset.PATHFINDER_1E)

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
