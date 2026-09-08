/**
 * Tests for the read-only actor view modal: sheet values render grouped by
 * section, empty fields are omitted, effects and marker colors show, and the
 * monster sheet definition is preferred for bestiary-derived NPCs.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import ActorViewModal from './ActorViewModal';
import { useStore } from '../store';

const rulesetConfig = {
  actor_sheet: {
    fields: [
      { key: 'hp.current', label: 'Current HP', type: 'number', section: 'Combat' },
      { key: 'defenses.ac', label: 'Armor Class', type: 'number', section: 'Combat' },
      { key: 'character.deity', label: 'Deity', type: 'text', section: 'Character' },
    ],
  },
  monster_sheet: {
    fields: [
      { key: 'monster.cr', label: 'CR', type: 'text', section: 'Identity' },
    ],
  },
};

const goblin = {
  id: 'a1',
  name: 'Goblin',
  is_pc: false,
  color: '#22cc66',
  sheet: { hp: { current: 6, max: 6 }, defenses: { ac: 16 }, character: { deity: '' } },
  effects: [{ name: 'Bless', duration_rounds: 4 }],
  notes: '',
};

function seedStore(actor) {
  useStore.setState({
    actors: [actor],
    viewingActorId: actor.id,
    rulesetConfig,
    fetchRulesetConfig: jest.fn(async () => rulesetConfig),
  });
}

test('renders sheet values grouped by section and omits empty fields', async () => {
  seedStore(goblin);
  render(<ActorViewModal />);

  expect(await screen.findByText('Goblin')).toBeInTheDocument();
  expect(screen.getByText('Combat')).toBeInTheDocument();
  expect(screen.getByText('Current HP')).toBeInTheDocument();
  expect(screen.getByText('6')).toBeInTheDocument();
  // Empty deity field is omitted entirely.
  expect(screen.queryByText('Deity')).not.toBeInTheDocument();
  // Effects render with duration.
  expect(screen.getByText('Bless')).toBeInTheDocument();
  expect(screen.getByText('(4r)')).toBeInTheDocument();
});

test('assigned marker color renders as a dot next to the name', async () => {
  seedStore(goblin);
  const { container } = render(<ActorViewModal />);

  await screen.findByText('Goblin');
  const dot = container.querySelector('.actor-color-dot');
  expect(dot).toHaveStyle({ backgroundColor: '#22cc66' });
});

test('prefers the monster sheet for bestiary-derived NPCs', async () => {
  seedStore({
    ...goblin,
    sheet: { bestiary: { entry_id: 1, source: 'Bestiary p. 1', url: '' }, monster: { cr: '3' } },
  });
  render(<ActorViewModal />);
  expect(await screen.findByText('Identity')).toBeInTheDocument();
  expect(screen.getByText('CR')).toBeInTheDocument();
  expect(screen.queryByText('Combat')).not.toBeInTheDocument();
});

test('close button clears the viewing actor', async () => {
  seedStore(goblin);
  render(<ActorViewModal />);

  fireEvent.click(await screen.findByLabelText('Close'));
  expect(useStore.getState().viewingActorId).toBeNull();
});

test('renders campaign templates via viewingTemplateId with a Template badge', () => {
  useStore.setState({
    actors: [],
    actorTemplates: [goblin],
    viewingActorId: null,
    viewingTemplateId: 'a1',
    rulesetConfig,
    fetchRulesetConfig: jest.fn(async () => rulesetConfig),
  });
  render(<ActorViewModal />);

  expect(screen.getByText('Goblin')).toBeInTheDocument();
  expect(screen.getByText(/Template/)).toBeInTheDocument();
  expect(screen.getByText('Combat')).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('Close'));
  expect(useStore.getState().viewingTemplateId).toBeNull();
});

test('renders nothing when no actor is selected', () => {
  useStore.setState({ actors: [], viewingActorId: null, rulesetConfig });
  const { container } = render(<ActorViewModal />);
  expect(container).toBeEmptyDOMElement();
});
