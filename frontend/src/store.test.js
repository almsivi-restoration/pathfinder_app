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

test('rollInitiative stores the returned order and marks the encounter active', async () => {
  axios.post.mockResolvedValueOnce({
    data: { initiative_order: ['a1', 'a2'], round: 1, current_turn_index: 0 },
  });

  await useStore.getState().rollInitiative();

  const state = useStore.getState();
  expect(state.initiativeOrder).toEqual(['a1', 'a2']);
  expect(state.currentRound).toBe(1);
  expect(state.isEncounterActive).toBe(true);
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

test('returnToCampaignSelector clears the full session without touching the network', () => {
  useStore.setState({
    currentCampaign: { name: 'Test' },
    actors: [{ id: 'a1' }],
    initiativeOrder: ['a1'],
    isEncounterActive: true,
  });

  useStore.getState().returnToCampaignSelector();

  const state = useStore.getState();
  expect(state.currentCampaign).toBeNull();
  expect(state.actors).toEqual([]);
  expect(state.initiativeOrder).toEqual([]);
  expect(state.isEncounterActive).toBe(false);
  expect(axios.post).not.toHaveBeenCalled();
  expect(axios.get).not.toHaveBeenCalled();
});
