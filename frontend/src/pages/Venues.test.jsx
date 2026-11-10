import { act, fireEvent, render, screen } from '@testing-library/react';
import Venues from './Venues';
import { useStore } from '../store';

const venueRecord = (id, name) => ({
  id,
  name,
  notes: '',
  grid: 'square',
  width: 12,
  height: 12,
  cells: {},
  edges: [],
  features: [],
  created_at: '2026-11-10T00:00:00',
  updated_at: '2026-11-10T00:00:00',
});

const CRYPT = venueRecord('crypt', 'Crypt');
const DOCKS = venueRecord('docks', 'Docks');
const summary = ({ id, name, width, height }) => ({ id, name, width, height });

let actions;

function seedStore(overrides = {}) {
  actions = {
    fetchVenues: jest.fn(),
    fetchVenue: jest.fn(async (id) => ({ crypt: CRYPT, docks: DOCKS }[id] || null)),
    createVenue: jest.fn(async (spec) => ({ ...venueRecord('new', spec.name), width: spec.width, height: spec.height })),
    saveVenue: jest.fn(async (venue) => venue),
    deleteVenue: jest.fn(async () => true),
    showVenue: jest.fn(async (id) => {
      useStore.setState({ shownVenueId: id });
      return true;
    }),
    hideVenue: jest.fn(async () => {
      useStore.setState({ shownVenueId: null });
      return true;
    }),
  };
  useStore.setState({
    currentCampaign: { name: 'Tomb of Horrors' },
    venues: [summary(CRYPT), summary(DOCKS)],
    shownVenueId: 'docks',
    operationError: null,
    venueEditorDirty: false,
    ...actions,
    ...overrides,
  });
}

beforeEach(() => {
  seedStore();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  window.confirm.mockRestore();
});

const openButton = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

test('lists the campaign venues and marks the one on the Venue Screen', () => {
  render(<Venues onBack={() => {}} />);

  expect(actions.fetchVenues).toHaveBeenCalled();
  expect(openButton('Crypt')).toHaveTextContent('12×12');
  expect(openButton('Docks')).toHaveTextContent('on the Venue Screen');
  expect(screen.getByText('Create a venue or pick one from the list.')).toBeInTheDocument();
});

test('creating a custom-size venue opens it in the editor', async () => {
  render(<Venues onBack={() => {}} />);

  fireEvent.change(screen.getByLabelText('New venue name'), { target: { value: '  Sunken Chapel ' } });
  fireEvent.change(screen.getByLabelText('New venue size'), { target: { value: 'custom' } });
  fireEvent.change(screen.getByLabelText('New venue width'), { target: { value: '30' } });
  fireEvent.change(screen.getByLabelText('New venue height'), { target: { value: '500' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Create venue' }));
  });

  expect(actions.createVenue).toHaveBeenCalledWith({ name: 'Sunken Chapel', width: 30, height: 100 });
  expect(screen.getByLabelText('Name')).toHaveValue('Sunken Chapel');
  expect(screen.getByLabelText('New venue name')).toHaveValue('');
});

test('switching venues with unsaved edits asks first', async () => {
  render(<Venues onBack={() => {}} />);

  await act(async () => {
    fireEvent.click(openButton('Crypt'));
  });
  expect(screen.getByLabelText('Name')).toHaveValue('Crypt');

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Crypt of Bones' } });
  expect(useStore.getState().venueEditorDirty).toBe(true);

  window.confirm.mockReturnValue(false);
  await act(async () => {
    fireEvent.click(openButton('Docks'));
  });
  expect(window.confirm).toHaveBeenCalledWith('Discard unsaved changes to this venue?');
  expect(actions.fetchVenue).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Name')).toHaveValue('Crypt of Bones');

  window.confirm.mockReturnValue(true);
  await act(async () => {
    fireEvent.click(openButton('Docks'));
  });
  expect(screen.getByLabelText('Name')).toHaveValue('Docks');
  expect(useStore.getState().venueEditorDirty).toBe(false);
});

test('deleting the open venue confirms and closes the editor', async () => {
  render(<Venues onBack={() => {}} />);

  await act(async () => {
    fireEvent.click(openButton('Crypt'));
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Delete Crypt' }));
  });

  expect(window.confirm).toHaveBeenCalledWith('Delete the venue "Crypt"? This cannot be undone.');
  expect(actions.deleteVenue).toHaveBeenCalledWith('crypt');
  expect(screen.queryByLabelText('Name')).toBeNull();
});

test('back is guarded by unsaved edits too', async () => {
  const onBack = jest.fn();
  render(<Venues onBack={onBack} />);

  await act(async () => {
    fireEvent.click(openButton('Crypt'));
  });
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } });

  window.confirm.mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Back to GM Dashboard' }));
  expect(onBack).not.toHaveBeenCalled();

  window.confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Back to GM Dashboard' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('without a campaign it explains what to do', () => {
  seedStore({ currentCampaign: null });
  render(<Venues onBack={() => {}} />);

  expect(screen.getByText('Load a campaign to build its venues.')).toBeInTheDocument();
  expect(actions.fetchVenues).not.toHaveBeenCalled();
});

test('the editor puts the open venue on the Venue Screen and takes it off again', async () => {
  render(<Venues onBack={() => {}} />);
  await act(async () => {
    fireEvent.click(openButton('Crypt'));
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Show players' }));
  });
  expect(actions.saveVenue).not.toHaveBeenCalled();
  expect(actions.showVenue).toHaveBeenCalledWith('crypt');
  expect(openButton('Crypt')).toHaveTextContent('on the Venue Screen');

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Hide from players' }));
  });
  expect(actions.hideVenue).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Show players' })).toBeInTheDocument();
});

test('showing unsaved edits saves them first, and a failed save shows nothing', async () => {
  render(<Venues onBack={() => {}} />);
  await act(async () => {
    fireEvent.click(openButton('Crypt'));
  });
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Crypt of Bones' } });

  actions.saveVenue.mockResolvedValueOnce(null);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Show players' }));
  });
  expect(actions.saveVenue).toHaveBeenCalledTimes(1);
  expect(actions.showVenue).not.toHaveBeenCalled();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Show players' }));
  });
  expect(actions.saveVenue).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'crypt', name: 'Crypt of Bones' }));
  expect(actions.showVenue).toHaveBeenCalledWith('crypt');
  expect(actions.saveVenue.mock.invocationCallOrder[1]).toBeLessThan(actions.showVenue.mock.invocationCallOrder[0]);
  expect(useStore.getState().venueEditorDirty).toBe(false);
});

test('the Open Venue Screen button only appears inside the desktop app', () => {
  const { unmount } = render(<Venues onBack={() => {}} />);
  expect(screen.queryByRole('button', { name: 'Open Venue Screen' })).toBeNull();
  unmount();

  window.electron = { openVenueWindow: jest.fn() };
  try {
    render(<Venues onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Venue Screen' }));
    expect(window.electron.openVenueWindow).toHaveBeenCalledTimes(1);
  } finally {
    delete window.electron;
  }
});
