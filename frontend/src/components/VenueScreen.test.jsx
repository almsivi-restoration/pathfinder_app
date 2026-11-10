import { act, render, screen } from '@testing-library/react';
import VenueScreen from './VenueScreen';
import { useStore } from '../store';

const shownVenue = {
  id: 'crypt',
  name: 'Sunken Crypt',
  grid: 'square',
  width: 4,
  height: 4,
  cells: { '1,1': 'floor', '2,1': 'floor', '1,2': 'floor', '2,2': 'floor' },
  edges: [{ x: 2, y: 1, side: 'w', kind: 'door' }],
  features: [{ id: 'f1', kind: 'chest', x: 1, y: 1, rotation: 0, label: '', gm_only: false }],
  updated_at: '2026-11-10T00:00:00',
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('waits for the GM and keeps polling the backend', () => {
  const fetchShownVenue = jest.fn(async () => null);
  useStore.setState({ shownVenue: null, fetchShownVenue });
  render(<VenueScreen />);

  expect(screen.getByText('Waiting for the GM to show a venue…')).toBeInTheDocument();
  // The header bar names the window before anything is shown, like the Player View's.
  expect(screen.getByRole('heading', { name: 'Venue Screen' })).toBeInTheDocument();
  expect(document.title).toBe('Venue Screen');
  expect(fetchShownVenue).toHaveBeenCalledTimes(1);
  act(() => {
    jest.advanceTimersByTime(4000);
  });
  expect(fetchShownVenue).toHaveBeenCalledTimes(3);
});

test('draws the shown venue for the players and returns to waiting when it is hidden', () => {
  useStore.setState({ shownVenue, fetchShownVenue: jest.fn(async () => shownVenue) });
  const { container } = render(<VenueScreen />);

  expect(screen.getByRole('heading', { name: 'Sunken Crypt' })).toBeInTheDocument();
  expect(container.querySelector('svg.venue-map')).toHaveClass('venue-map-player');
  expect(container.querySelector('[data-kind="chest"]')).not.toBeNull();
  expect(container.querySelectorAll('.venue-map-door')).toHaveLength(1);

  act(() => {
    useStore.setState({ shownVenue: null });
  });
  expect(screen.getByText('Waiting for the GM to show a venue…')).toBeInTheDocument();
});

// The backend strips hidden content; the player-mode renderer is the second lock.
test('never draws GM-only content even if it reaches the screen', () => {
  const leaky = {
    ...shownVenue,
    edges: [{ x: 2, y: 1, side: 'w', kind: 'secret_door' }],
    features: [...shownVenue.features, { id: 'f2', kind: 'trap', x: 2, y: 2, rotation: 0, label: 'Pit', gm_only: true }],
  };
  useStore.setState({ shownVenue: leaky, fetchShownVenue: jest.fn(async () => leaky) });
  const { container } = render(<VenueScreen />);

  expect(container.querySelector('[data-kind="trap"]')).toBeNull();
  expect(container.querySelectorAll('.venue-map-secret')).toHaveLength(0);
  expect(container.textContent).not.toContain('Pit');
});
