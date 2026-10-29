/**
 * Current-turn highlighting on the GM screen: the actor table and the
 * initiative list must mark exactly the actor whose turn it is, resolved by
 * ID from the saved initiative order.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import ActorList from './ActorList';
import InitiativeTracker from './InitiativeTracker';
import { useStore } from '../store';

const rulesetConfig = {
  actor_sheet: {
    summary: [{ label: 'HP', value_key: 'hp.current', secondary_key: 'hp.max' }],
  },
};

const actors = [
  { id: 'a', name: 'Alpha', is_pc: true, sheet: { hp: { current: 10, max: 10 } }, effects: [] },
  { id: 'b', name: 'Bravo', is_pc: false, sheet: { hp: { current: 8, max: 10 } }, effects: [] },
  { id: 'c', name: 'Charlie', is_pc: false, sheet: { hp: { current: 6, max: 10 } }, effects: [] },
];

function seedStore(overrides = {}) {
  useStore.setState({
    currentScene: { id: 's1', name: 'Scene' },
    actors,
    initiativeOrder: ['a', 'b', 'c'],
    currentRound: 1,
    currentTurnIndex: 1,
    isSceneActive: true,
    rulesetConfig,
    ...overrides,
  });
}

describe('GM actor table', () => {
  test('marks only the current-turn actor', () => {
    seedStore();
    const { container } = render(<ActorList />);

    const current = container.querySelectorAll('.actor-row.current-turn');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Bravo');
    expect(current[0]).toHaveAttribute('aria-current', 'true');
    expect(current[0].querySelector('.turn-marker')).toBeInTheDocument();
  });

  test('marks nobody outside combat', () => {
    seedStore({ isSceneActive: false });
    const { container } = render(<ActorList />);

    expect(container.querySelector('.actor-row.current-turn')).not.toBeInTheDocument();
    expect(container.querySelector('.turn-marker')).not.toBeInTheDocument();
  });
});

describe('GM initiative list', () => {
  test('marks the current-turn actor', () => {
    seedStore();
    const { container } = render(<InitiativeTracker />);

    const current = container.querySelectorAll('.initiative-item.current-turn');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Bravo');
  });

  test('an unsaved reorder keeps the highlight on the same actor', () => {
    seedStore();
    const { container } = render(<InitiativeTracker />);

    // Move Alpha down into index 1 locally (not yet saved).
    fireEvent.click(screen.getByRole('button', { name: 'Move Alpha down' }));

    const current = container.querySelectorAll('.initiative-item.current-turn');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Bravo');
  });
});
