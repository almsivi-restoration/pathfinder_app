import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import VenueEditor, { actorStampChoices } from './VenueEditor';
import { useStore } from '../store';

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

test('actor stamps copy a template or scene actor once, and place a snapshot of its marker', async () => {
  const goblin = { name: 'Goblin', symbol: 'cross', color: '#2f8f2f' };
  expect(actorStampChoices(
    [goblin, { name: '  ' }],
    [{ ...goblin, id: 'a1' }, { name: 'Mira', color: 'tomato' }],
  )).toEqual([
    { ...goblin, key: 'Goblin|cross|#2f8f2f' },
    { name: 'Mira', symbol: null, color: null, key: 'Mira|null|null' },
  ]);

  useStore.setState({ actorTemplates: [goblin], actors: [] });
  try {
    const { container, svg, onSave } = renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /Goblin/ }));
    fireEvent.pointerDown(svg, at(1, 1));
    fireEvent.pointerUp(svg, at(1, 1));
    expect(container.querySelector('[data-kind="actor"] .marker-base-disc')).not.toBeNull();
    expect(container.querySelector('[data-kind="actor"] title')).toHaveTextContent('Goblin');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(onSave.mock.calls[0][0].features).toEqual([
      expect.objectContaining({ kind: 'actor', x: 1, y: 1, label: 'Goblin', symbol: 'cross', color: '#2f8f2f' }),
    ]);
  } finally {
    // Unmount first so resetting the shared store does not re-render a live editor.
    cleanup();
    useStore.setState({ actorTemplates: [], actors: [] });
  }
});

test('custom stamps are imported, placed by id, fall back when their image is gone, and edit their mat mark', async () => {
  const altar = { id: 's1', name: 'Shrine of Ash', mat_glyph: 'Al', media_type: 'image/svg+xml' };
  const uploadCustomStamp = jest.fn(async () => {
    useStore.setState({ customStamps: [altar] });
    return altar;
  });
  const updateCustomStamp = jest.fn(async () => null);
  const original = useStore.getState();
  useStore.setState({ customStamps: [], uploadCustomStamp, updateCustomStamp });
  try {
    const { container, svg } = renderEditor();
    const file = new File(['<svg/>'], 'altar.svg', { type: 'image/svg+xml' });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Custom stamp image file'), { target: { files: [file] } });
    });
    expect(uploadCustomStamp).toHaveBeenCalledWith(file);
    expect(screen.getByRole('button', { name: 'Shrine of Ash' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.pointerDown(svg, at(2, 1));
    fireEvent.pointerUp(svg, at(2, 1));
    const placed = container.querySelector('svg.venue-map [data-kind="custom"]');
    const image = placed.querySelector('image');
    expect(image.getAttribute('href')).toMatch(/\/venue\/stamps\/s1\/image$/);
    expect(screen.getByRole('heading', { name: 'Shrine of Ash' })).toBeInTheDocument();

    fireEvent.error(image);
    expect(placed.querySelector('image')).toBeNull();
    expect(placed.querySelector('.custom-stamp-missing')).not.toBeNull();

    const mark = screen.getByLabelText(/Mat mark/);
    fireEvent.change(mark, { target: { value: 'A' } });
    fireEvent.blur(mark);
    expect(updateCustomStamp).toHaveBeenCalledWith('s1', { name: 'Shrine of Ash', matGlyph: 'A' });
  } finally {
    // Unmount first so resetting the shared store does not re-render a live editor.
    cleanup();
    useStore.setState({
      customStamps: [],
      uploadCustomStamp: original.uploadCustomStamp,
      updateCustomStamp: original.updateCustomStamp,
    });
  }
});

test('a selected stamp grows by dragging its corner handle and moves by its grab point', () => {
  const { container, svg } = renderEditor();

  fireEvent.click(screen.getByRole('button', { name: 'Statue' }));
  fireEvent.pointerDown(svg, at(0, 0));
  fireEvent.pointerUp(svg, at(0, 0));
  fireEvent.click(screen.getByRole('button', { name: /^Select/ }));
  fireEvent.pointerDown(svg, at(0, 0)); // select it
  fireEvent.pointerUp(svg, at(0, 0));
  expect(container.querySelector('.venue-map-resize-handle')).not.toBeNull();

  // at(c) is the middle of square c, so at(0.5) is the grid line between squares 0 and 1.
  drag(svg, [0.5, 0.5], [1.5, 1.5]); // the handle sits on the bottom-right corner
  expect(screen.getByLabelText('Stamp width in squares')).toHaveValue(2);
  expect(screen.getByLabelText('Stamp height in squares')).toHaveValue(2);

  drag(svg, [1, 1], [2, 2]); // grabbed by its lower-right square
  fireEvent.change(screen.getByLabelText('Stamp width in squares'), { target: { value: '8' } });
  const statue = container.querySelector('[data-kind="statue"]');
  expect(statue.getAttribute('transform')).toBe('translate(40 40)');
  // Typed sizes are clamped to the room left on the 4-wide map.
  expect(screen.getByLabelText('Stamp width in squares')).toHaveValue(3);
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

test('dragging the door tool along a line lays one wide door, and dragging again clears it', () => {
  const venue = { ...blankVenue(), cells: { '0,0': 'floor', '1,0': 'floor', '2,0': 'floor' } };
  const { container, svg } = renderEditor(venue);

  fireEvent.click(screen.getByRole('button', { name: 'Door' }));
  drag(svg, [0, 0.45], [2, 0.45]); // just above the line under row 0
  const doors = container.querySelectorAll('.venue-map-door');
  expect(doors).toHaveLength(1);
  expect(doors[0]).toHaveAttribute('data-length', '3');

  drag(svg, [0, 0.45], [1, 0.45]);
  expect(container.querySelectorAll('.venue-map-door')).toHaveLength(1);
  expect(container.querySelector('.venue-map-door')).toHaveAttribute('data-length', '1');
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
