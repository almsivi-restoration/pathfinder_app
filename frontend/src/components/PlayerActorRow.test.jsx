/**
 * Regression tests for PlayerActorRow's player-visible display logic - the exact behavior
 * the original spec called for: PC actors show "X/Y" HP, NPC actors show a green->red
 * health-percentage bar, and status effects/current-turn highlight render correctly.
 */
import { render, screen } from '@testing-library/react';
import PlayerActorRow from './PlayerActorRow';

const baseActor = {
  id: 'a1',
  name: 'Goblin',
  is_pc: false,
  sheet: { hp: { current: 10, max: 10 } },
  effects: [],
};

const rulesetConfig = {
  actor_sheet: {
    player_resource: { current_key: 'hp.current', max_key: 'hp.max' },
  },
};

test('PC actors display exact "current/max" HP text, not a bar', () => {
  const actor = { ...baseActor, is_pc: true, sheet: { hp: { current: 7, max: 12 } } };
  render(<PlayerActorRow actor={actor} position={1} isCurrent={false} rulesetConfig={rulesetConfig} />);

  expect(screen.getByText('7/12')).toBeInTheDocument();
});

test('NPC actors above 50% health render a green bar', () => {
  const actor = { ...baseActor, sheet: { hp: { current: 8, max: 10 } } }; // 80%
  const { container } = render(<PlayerActorRow actor={actor} position={1} isCurrent={false} rulesetConfig={rulesetConfig} />);

  const fill = container.querySelector('.health-bar-fill');
  expect(fill).toHaveStyle({ backgroundColor: '#4CAF50', width: '80%' });
});

test('NPC actors at or below 50% health render an orange bar', () => {
  const actor = { ...baseActor, sheet: { hp: { current: 5, max: 10 } } }; // 50%
  const { container } = render(<PlayerActorRow actor={actor} position={1} isCurrent={false} rulesetConfig={rulesetConfig} />);

  const fill = container.querySelector('.health-bar-fill');
  expect(fill).toHaveStyle({ backgroundColor: '#FF9800' });
});

test('NPC actors at or below 25% health render a red bar', () => {
  const actor = { ...baseActor, sheet: { hp: { current: 2, max: 10 } } }; // 20%
  const { container } = render(<PlayerActorRow actor={actor} position={1} isCurrent={false} rulesetConfig={rulesetConfig} />);

  const fill = container.querySelector('.health-bar-fill');
  expect(fill).toHaveStyle({ backgroundColor: '#F44336' });
});

test('status effects render with their remaining duration', () => {
  const actor = {
    ...baseActor,
    effects: [{ name: 'Poisoned', duration_rounds: 3 }],
  };
  render(<PlayerActorRow actor={actor} position={1} isCurrent={false} rulesetConfig={rulesetConfig} />);

  expect(screen.getByText('Poisoned')).toBeInTheDocument();
  expect(screen.getByText('(3r)')).toBeInTheDocument();
});

test('the current-turn actor gets the highlight class', () => {
  const { container } = render(
    <PlayerActorRow actor={baseActor} position={1} isCurrent={true} rulesetConfig={rulesetConfig} />
  );

  expect(container.querySelector('.player-actor-row')).toHaveClass('current-turn');
});
