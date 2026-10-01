/**
 * Regression tests for PlayerView's display order: during combat the active
 * actor leads the list (position badges keep true initiative numbers); outside
 * combat the order is untouched.
 */
import { render } from '@testing-library/react';
import PlayerView from './PlayerView';
import { useStore } from '../store';

const rulesetConfig = {
  actor_sheet: {
    player_resource: { current_key: 'hp.current', max_key: 'hp.max' },
  },
};

const actorA = { id: 'a', name: 'Alpha', is_pc: true, sheet: { hp: { current: 10, max: 10 } }, effects: [] };
const actorB = { id: 'b', name: 'Bravo', is_pc: false, sheet: { hp: { current: 10, max: 10 } }, effects: [] };
const actorC = { id: 'c', name: 'Charlie', is_pc: false, sheet: { hp: { current: 10, max: 10 } }, effects: [] };

function seedStore(overrides = {}) {
  useStore.setState({
    actors: [actorA, actorB, actorC],
    initiativeOrder: ['a', 'b', 'c'],
    currentRound: 1,
    currentTurnIndex: 0,
    isSceneActive: true,
    rulesetConfig,
    fetchCurrentScene: jest.fn(),
    fetchRulesetConfig: jest.fn(),
    ...overrides,
  });
}

function renderedNames(container) {
  return [...container.querySelectorAll('.actor-name')].map((el) => el.textContent);
}

function renderedPositions(container) {
  return [...container.querySelectorAll('.position-badge')].map((el) => el.textContent);
}

test('the active actor leads the list when combat is active', () => {
  seedStore({ currentTurnIndex: 1 });
  const { container } = render(<PlayerView />);

  expect(renderedNames(container)).toEqual(['Bravo', 'Charlie', 'Alpha']);
});

test('position badges keep their true initiative numbers after rotation', () => {
  seedStore({ currentTurnIndex: 1 });
  const { container } = render(<PlayerView />);

  expect(renderedPositions(container)).toEqual(['2', '3', '1']);
});

test('order is untouched when no turn has advanced', () => {
  seedStore({ currentTurnIndex: 0 });
  const { container } = render(<PlayerView />);

  expect(renderedNames(container)).toEqual(['Alpha', 'Bravo', 'Charlie']);
});

test('order is untouched when the scene is not in combat', () => {
  seedStore({ isSceneActive: false, currentTurnIndex: 2 });
  const { container } = render(<PlayerView />);

  expect(renderedNames(container)).toEqual(['Alpha', 'Bravo', 'Charlie']);
});
