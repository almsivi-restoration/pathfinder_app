import { act, fireEvent, render, screen } from '@testing-library/react';
import VenueEditor from './VenueEditor';

// jsdom 16 has no PointerEvent; React listens for the native pointer events.
let originalPointerEvent;
beforeAll(() => {
  originalPointerEvent = window.PointerEvent;
  if (!window.PointerEvent) {
    window.PointerEvent = class PointerEvent extends MouseEvent {
      constructor(type, init = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    };
  }
});
afterAll(() => {
  window.PointerEvent = originalPointerEvent;
});

const blankVenue = () => ({
  id: 'v1',
  name: 'Crypt',
  notes: '',
  grid: 'square',
  width: 4,
  height: 4,
  cells: {},
  edges: [],
  features: [],
  created_at: '2026-11-10T00:00:00',
  updated_at: '2026-11-10T00:00:00',
});

// viewBox is 200x200 for a 4x4 venue; a 200px box makes client px equal viewBox units.
function renderEditor(venue = blankVenue(), onSave = jest.fn(async (saved) => saved)) {
  const utils = render(<VenueEditor venue={venue} onSave={onSave} onDirtyChange={jest.fn()} />);
  const svg = utils.container.querySelector('svg.venue-map');
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200 });
  return { ...utils, svg, onSave };
}

const at = (cx, cy) => ({ clientX: 40 + cx * 40, clientY: 40 + cy * 40, button: 0, pointerId: 1 });

function drag(svg, from, to) {
  fireEvent.pointerDown(svg, at(...from));
  fireEvent.pointerMove(svg, at(...to));
  fireEvent.pointerUp(svg, at(...to));
}

test('dragging a room paints a rectangle, and save sends it', async () => {
  const { svg, onSave } = renderEditor();

  drag(svg, [0, 0], [1, 1]);
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  });
  expect(onSave).toHaveBeenCalledTimes(1);
  const saved = onSave.mock.calls[0][0];
  expect(Object.keys(saved.cells).sort()).toEqual(['0,0', '0,1', '1,0', '1,1']);
  expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();
});

test('undo and redo walk the edit history', () => {
  const { container, svg } = renderEditor();

  drag(svg, [0, 0], [1, 0]);
  expect(container.querySelector('[data-terrain="floor"]')).not.toBeNull();

  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(container.querySelector('[data-terrain="floor"]')).toBeNull();
  expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();

  fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
  expect(container.querySelector('[data-terrain="floor"]')).not.toBeNull();
});

test('stamps are placed, inspected, and deleted with the keyboard', () => {
  const { container, svg } = renderEditor();

  fireEvent.click(screen.getByRole('button', { name: 'Barrel' }));
  fireEvent.pointerDown(svg, at(2, 2));
  fireEvent.pointerUp(svg, at(2, 2));

  expect(container.querySelector('[data-kind="barrel"]')).not.toBeNull();
  expect(screen.getByRole('heading', { name: 'Barrel' })).toBeInTheDocument();

  fireEvent.keyDown(window, { key: 'Delete' });
  expect(container.querySelector('[data-kind="barrel"]')).toBeNull();
});

test('tool shortcuts are ignored while typing in a field', () => {
  renderEditor();

  const name = screen.getByLabelText('Name');
  fireEvent.keyDown(name, { key: 'w' });
  expect(screen.getByRole('button', { name: 'Room' })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.keyDown(window, { key: 'w' });
  expect(screen.getByRole('button', { name: 'Wall' })).toHaveAttribute('aria-pressed', 'true');
});

test('doors need terrain beside them, and the preview hides secret doors', () => {
  const venue = { ...blankVenue(), cells: { '0,0': 'floor', '1,0': 'floor' } };
  const { container, svg } = renderEditor(venue);

  fireEvent.click(screen.getByRole('button', { name: 'Secret' }));
  fireEvent.pointerDown(svg, { ...at(1, 0), clientX: 20 + 40 * 1.05 }); // just right of the x=1 line
  expect(container.querySelectorAll('.venue-map-secret')).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: 'Door' }));
  fireEvent.pointerDown(svg, at(3, 3)); // empty space on both sides
  expect(container.querySelectorAll('.venue-map-door')).toHaveLength(0);

  fireEvent.click(screen.getByLabelText('Player preview'));
  expect(container.querySelector('.venue-map-secret')).toBeNull();
});

test('renaming is saved but is not undone with the map edits', async () => {
  const { svg, onSave } = renderEditor();

  drag(svg, [0, 0], [0, 0]);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Sunken Chapel  ' } });
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  });
  expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'Sunken Chapel', cells: {} });
});

test('the Mat Guide opens over the editor with unsaved edits, and pauses editor shortcuts', () => {
  const { svg } = renderEditor();
  const floor = () => svg.querySelector('[data-terrain="floor"]');

  drag(svg, [0, 0], [1, 1]);
  fireEvent.click(screen.getByRole('button', { name: 'Mat Guide' }));

  const guide = screen.getByRole('dialog', { name: 'Mat Guide: Crypt' });
  expect(guide).toHaveTextContent('2 × 2');
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(floor()).not.toBeNull();

  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Mat Guide: Crypt' })).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(floor()).toBeNull();
});

// Player preview says "editing is paused" and hides the selection; the keys that edit a
// stamp or switch tools must pause with it, or Delete removes a stamp the GM cannot see selected.
test('player preview pauses the editing keys', () => {
  const { container, svg } = renderEditor();

  fireEvent.click(screen.getByRole('button', { name: 'Barrel' }));
  fireEvent.pointerDown(svg, at(2, 2));
  fireEvent.pointerUp(svg, at(2, 2));
  fireEvent.click(screen.getByLabelText('Player preview'));

  fireEvent.keyDown(window, { key: 'Delete' });
  fireEvent.keyDown(window, { key: ']' });
  fireEvent.keyDown(window, { key: 'w' });
  fireEvent.click(screen.getByLabelText('Player preview'));

  expect(container.querySelector('[data-kind="barrel"]')).not.toBeNull();
  expect(container.querySelector('[data-kind="barrel"] g[transform*="rotate"]')).toBeNull();
  expect(screen.getByRole('button', { name: 'Stamp' })).toHaveAttribute('aria-pressed', 'true');

  // Out of preview the same keys work again.
  fireEvent.keyDown(window, { key: 'Delete' });
  expect(container.querySelector('[data-kind="barrel"]')).toBeNull();
});

// The hover and selection cues sit on the map's fixed paper, so each accent stroke is
// drawn over a casing in the map's own ink rather than relying on the theme accent.
test('hover and selection cues carry an ink casing', () => {
  const venue = { ...blankVenue(), cells: { '0,0': 'floor' } };
  const { container, svg } = renderEditor(venue);

  fireEvent.pointerMove(svg, at(0, 0));
  expect(container.querySelector('.venue-hover-cell-casing')).toHaveAttribute('stroke', '#2b2116');
  expect(container.querySelector('.venue-hover-cell')).not.toBeNull();

  fireEvent.keyDown(window, { key: 'w' });
  fireEvent.pointerMove(svg, at(0, 0));
  expect(container.querySelector('.venue-hover-edge-casing')).toHaveAttribute('stroke', '#2b2116');

  fireEvent.click(screen.getByRole('button', { name: 'Barrel' }));
  fireEvent.pointerDown(svg, at(2, 2));
  fireEvent.pointerUp(svg, at(2, 2));
  expect(container.querySelector('[data-kind="barrel"] .venue-map-casing')).not.toBeNull();
  expect(container.querySelector('[data-kind="barrel"] .venue-map-selection')).not.toBeNull();
});
