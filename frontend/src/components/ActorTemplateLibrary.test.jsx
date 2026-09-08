/**
 * Regression tests for ActorTemplateLibrary row controls: the color swatch is a
 * fixed-size button proxying a hidden native input (bare color inputs ignore
 * CSS sizing and break the row layout), and Add to Scene only renders when a
 * scene is open — on the campaign screen it has no valid target and must hide.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import ActorTemplateLibrary from './ActorTemplateLibrary';
import { useStore } from '../store';

const template = {
  id: 't1',
  name: 'Goblin',
  is_pc: false,
  color: '#22cc66',
  sheet: { hp: { current: 6, max: 6 }, defenses: { ac: 16 }, initiative: { bonus: 2 } },
  effects: [],
  notes: '',
};

const rulesetConfig = {
  actor_sheet: {
    summary: [
      { label: 'HP', value_key: 'hp.current', secondary_key: 'hp.max' },
      { label: 'AC', value_key: 'defenses.ac' },
      { label: 'Init', value_key: 'initiative.bonus', signed: true },
    ],
  },
};

function seedStore(currentScene) {
  useStore.setState({
    actorTemplates: [template],
    listActorTemplates: jest.fn(),
    addActorFromTemplate: jest.fn(async () => ({})),
    updateActorTemplate: jest.fn(async () => ({})),
    removeActorTemplate: jest.fn(async () => true),
    setSelectedTemplateId: jest.fn(),
    setViewingTemplateId: jest.fn(),
    currentScene,
    rulesetConfig,
  });
}

test('assigned color renders as a styled swatch, not a visible native input', () => {
  seedStore({ id: 's1' });
  const { container } = render(<ActorTemplateLibrary />);

  const swatch = container.querySelector('.color-swatch.assigned');
  expect(swatch).toBeInTheDocument();
  expect(swatch).toHaveStyle({ backgroundColor: '#22cc66' });

  const nativeInput = container.querySelector('.color-swatch-input');
  expect(nativeInput).toBeInTheDocument();
  expect(nativeInput).toHaveAttribute('aria-hidden', 'true');
});

test('clearing the color calls updateActorTemplate with null', () => {
  seedStore({ id: 's1' });
  render(<ActorTemplateLibrary />);

  fireEvent.click(screen.getByTitle('Clear marker color'));
  expect(useStore.getState().updateActorTemplate).toHaveBeenCalledWith(
    't1',
    expect.objectContaining({ color: null }),
  );
});

test('Add to Scene renders only when a scene is open', () => {
  seedStore({ id: 's1' });
  const { rerender } = render(<ActorTemplateLibrary />);
  expect(screen.getByText('Add to Scene')).toBeInTheDocument();

  seedStore(null);
  rerender(<ActorTemplateLibrary />);
  expect(screen.queryByText('Add to Scene')).not.toBeInTheDocument();
});
