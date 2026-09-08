/**
 * Regression tests for the Zustand store's core actions. axios is mocked so these run
 * fully offline against no real backend - they verify the store's own state transitions,
 * not the API contract (that's covered by backend/tests/test_api.py).
 */
import axios from 'axios';
import { useStore } from './store';

jest.mock('axios');

const initialState = useStore.getState();

beforeEach(() => {
  // Zustand's store is a module-level singleton - reset it between tests so one test's
  // state changes can't leak into the next.
  useStore.setState(initialState, true);
  jest.clearAllMocks();
});

test('addActor appends the server-assigned actor to state', async () => {
  const serverActor = { id: 'actor-1', name: 'Goblin', hp_current: 10, hp_max: 10 };
  axios.post.mockResolvedValueOnce({ data: serverActor });

  await useStore.getState().addActor({ id: '', name: 'Goblin' });

  expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining('/actor/add'),
    expect.objectContaining({ name: 'Goblin' })
  );
  expect(useStore.getState().actors).toEqual([serverActor]);
});

test('removeActor removes only the targeted actor from state', async () => {
  useStore.setState({
    actors: [
      { id: 'a1', name: 'Goblin' },
      { id: 'a2', name: 'Orc' },
    ],
  });
  axios.delete.mockResolvedValueOnce({});

  await useStore.getState().removeActor('a1');

  expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/actor/a1'));
  expect(useStore.getState().actors).toEqual([{ id: 'a2', name: 'Orc' }]);
});

test('deleteCampaign removes only the targeted campaign from state', async () => {
  useStore.setState({ campaigns: ['Keep', 'Remove'] });
  axios.delete.mockResolvedValueOnce({});

  await useStore.getState().deleteCampaign('Remove');

  expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/campaign/Remove'));
  expect(useStore.getState().campaigns).toEqual(['Keep']);
});

test('rollInitiative stores the returned order and marks the scene active', async () => {
  axios.post.mockResolvedValueOnce({
    data: { initiative_order: ['a1', 'a2'], round: 1, current_turn_index: 0 },
  });

  await useStore.getState().rollInitiative();

  const state = useStore.getState();
  expect(state.initiativeOrder).toEqual(['a1', 'a2']);
  expect(state.currentRound).toBe(1);
  expect(state.isSceneActive).toBe(true);
});

test('setInitiativeOrder persists a GM-entered manual order', async () => {
  axios.post.mockResolvedValueOnce({
    data: { initiative_order: ['a2', 'a1'], round: 1, current_turn_index: 0 },
  });

  await useStore.getState().setInitiativeOrder(['a2', 'a1']);

  expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining('/initiative/set'),
    { actor_ids: ['a2', 'a1'] }
  );
  expect(useStore.getState().initiativeOrder).toEqual(['a2', 'a1']);
});

test('createScene marks both the new scene and its campaign reference as unsaved', async () => {
  const scene = { id: 'scene-1', name: 'Ambush', actors: [], initiative_order: [] };
  axios.post.mockResolvedValueOnce({ data: scene });

  await useStore.getState().createScene('Ambush');

  expect(useStore.getState().isCampaignDirty).toBe(true);
  expect(useStore.getState().isSceneDirty).toBe(true);
  expect(useStore.getState().campaignScenes).toEqual([scene]);
});

test('saveScene reports failure and retains unsaved state', async () => {
  useStore.setState({ isSceneDirty: true });
  axios.post.mockRejectedValueOnce({ response: { data: { detail: 'No scene loaded' } } });

  const saved = await useStore.getState().saveScene();

  expect(saved).toBe(false);
  expect(useStore.getState().isSceneDirty).toBe(true);
  expect(useStore.getState().operationError).toBe('No scene loaded');
});

test('searchCurrentReferences stores ruleset-scoped search results', async () => {
  const results = [{ title: 'Core Rulebook', filename: 'core_rulebook.pdf', page_number: 12, excerpt: 'Initiative.' }];
  axios.get.mockResolvedValueOnce({ data: { results } });

  await useStore.getState().searchCurrentReferences('initiative');

  expect(axios.get).toHaveBeenCalledWith(
    expect.stringContaining('/references/current/search'),
    { params: { query: 'initiative' } }
  );
  expect(useStore.getState().referenceResults).toEqual(results);
});

test('returnToCampaignSelector clears the full session without touching the network', () => {
  useStore.setState({
    currentCampaign: { name: 'Test' },
    actors: [{ id: 'a1' }],
    initiativeOrder: ['a1'],
    isSceneActive: true,
  });

  useStore.getState().returnToCampaignSelector();

  const state = useStore.getState();
  expect(state.currentCampaign).toBeNull();
  expect(state.actors).toEqual([]);
  expect(state.initiativeOrder).toEqual([]);
  expect(state.isSceneActive).toBe(false);
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.get).not.toHaveBeenCalled();
});

test('rollDice posts the roll spec to /roll and returns the result', async () => {
  const result = { total: 19, die_roll: 14, modifier: 5, bonus_dice_roll: null };
  axios.post.mockResolvedValueOnce({ data: result });

  const returned = await useStore.getState().rollDice({ dieType: 20, modifier: 5 });

  expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining('/roll'),
    { die_type: 20, modifier: 5, bonus_dice: 0 }
  );
  expect(returned).toEqual(result);
});

test('rollDice surfaces a failure via operationError and returns null', async () => {
  axios.post.mockRejectedValueOnce({ response: { data: { detail: 'Roll failed' } } });

  const returned = await useStore.getState().rollDice({ dieType: 20, modifier: 5 });

  expect(returned).toBeNull();
  expect(useStore.getState().operationError).toBe('Roll failed');
});
