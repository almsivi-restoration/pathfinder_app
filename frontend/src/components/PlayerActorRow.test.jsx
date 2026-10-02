/**
 * Regression tests for PlayerActorRow's player-visible display logic: PC actors show
 * exact current/max HP inside a health bar, NPC actors show a green->red health bar,
 * and status effects/current-turn highlight render correctly. Also covers the health
 * bar impact effects (shake/flash/ghost on damage, glow on heal) that fire when a
 * poll sees the HP value move.
 */
import { act, render, screen } from '@testing-library/react';
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

test('PC actors display exact current/max HP inside a health bar', () => {
  const actor = { ...baseActor, is_pc: true, sheet: { hp: { current: 7, max: 12 } } };
  render(<PlayerActorRow actor={actor} position={1} isCurrent={false} rulesetConfig={rulesetConfig} />);

  const healthValue = screen.getByText('7/12');
  expect(healthValue).toHaveClass('health-bar-value');

  const healthBar = healthValue.closest('.health-bar-background');
  expect(healthBar).not.toBeNull();
  expect(healthBar.querySelector('.health-bar-fill')).toBeInTheDocument();
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

test('an assigned marker color renders a dot and a left accent border', () => {
  const actor = { ...baseActor, color: '#8e44ad' };
  const { container } = render(
    <PlayerActorRow actor={actor} position={1} isCurrent={false} rulesetConfig={rulesetConfig} />
  );

  const dot = container.querySelector('.actor-color-dot');
  expect(dot).toHaveStyle({ backgroundColor: '#8e44ad' });
  expect(container.querySelector('.player-actor-row')).toHaveStyle({ borderLeft: '14px solid #8e44ad' });
});

test('no color assigned renders no dot and no accent border', () => {
  const { container } = render(
    <PlayerActorRow actor={baseActor} position={1} isCurrent={false} rulesetConfig={rulesetConfig} />
  );

  expect(container.querySelector('.actor-color-dot')).not.toBeInTheDocument();
  expect(container.querySelector('.player-actor-row').style.borderLeft).toBe('');
});

describe('health bar impact effects', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const row = (hp) => (
    <PlayerActorRow
      actor={{ ...baseActor, sheet: { hp } }}
      position={1}
      isCurrent={false}
      rulesetConfig={rulesetConfig}
    />
  );

  test('first render establishes the baseline without playing an effect', () => {
    const { container } = render(row({ current: 20, max: 40 }));
    expect(container.querySelector('.health-bar-background')).not.toHaveClass('hp-fx-hit-big');
    expect(container.querySelector('.health-bar-ghost')).not.toBeInTheDocument();
  });

  test('a big HP drop (>=20% of max) shakes the bar and ghosts the lost chunk', () => {
    const { container, rerender } = render(row({ current: 20, max: 40 }));
    rerender(row({ current: 8, max: 40 })); // lost 12/40 = 30%

    const bar = container.querySelector('.health-bar-background');
    expect(bar).toHaveClass('hp-fx-hit-big');
    const ghost = container.querySelector('.health-bar-ghost');
    expect(ghost).toHaveStyle({ width: '50%' }); // old fill extent: 20/40
  });

  test('a small HP drop flashes without the big-hit shake', () => {
    const { container, rerender } = render(row({ current: 20, max: 40 }));
    rerender(row({ current: 18, max: 40 })); // lost 2/40 = 5%

    const bar = container.querySelector('.health-bar-background');
    expect(bar).toHaveClass('hp-fx-hit');
    expect(bar).not.toHaveClass('hp-fx-hit-big');
    expect(container.querySelector('.health-bar-ghost')).toBeInTheDocument();
  });

  test('an HP gain plays the heal glow with no damage ghost', () => {
    const { container, rerender } = render(row({ current: 10, max: 40 }));
    rerender(row({ current: 16, max: 40 }));

    const bar = container.querySelector('.health-bar-background');
    expect(bar).toHaveClass('hp-fx-heal');
    expect(container.querySelector('.health-bar-ghost')).not.toBeInTheDocument();
  });

  test('the effect clears after its linger window', () => {
    const { container, rerender } = render(row({ current: 20, max: 40 }));
    rerender(row({ current: 8, max: 40 }));
    expect(container.querySelector('.health-bar-background')).toHaveClass('hp-fx-hit-big');

    act(() => jest.advanceTimersByTime(1100));
    expect(container.querySelector('.health-bar-background')).not.toHaveClass('hp-fx-hit-big');
    expect(container.querySelector('.health-bar-ghost')).not.toBeInTheDocument();
  });
});
