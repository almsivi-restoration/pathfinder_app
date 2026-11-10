import { fireEvent, render, screen, within } from '@testing-library/react';
import MatGuide from './MatGuide';
import MatSheet from './MatSheet';
import { planMat } from '../matGuide';

const venueWith = ({ width = 24, height = 24, cells = {}, edges = [], features = [], name = 'Crypt' } = {}) => ({
  id: 'v1', name, notes: '', grid: 'square', width, height, cells, edges, features,
});

const fill = (terrain, x0, y0, x1, y1, into = {}) => {
  const cells = { ...into };
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) cells[`${x},${y}`] = terrain;
  }
  return cells;
};

// A 4 x 4 room at C4:F7; on the default 34 x 48 mat it centers 15 squares in and 22 down.
const crypt = () => venueWith({ cells: fill('floor', 2, 3, 5, 6) });

const renderGuide = (venue = crypt(), onClose = jest.fn()) => {
  render(<MatGuide venue={venue} onClose={onClose} />);
  return { dialog: screen.getByRole('dialog', { name: `Mat Guide: ${venue.name}` }), onClose };
};

const steps = () => within(screen.getByRole('region', { name: 'How to draw it' }));
const sheetText = () => screen.getByRole('img', { name: /square mat/ }).textContent;
const axisLabels = () => document.querySelectorAll('.mat-sheet .mat-axis text').length;

test('explains where the map starts on the mat', () => {
  renderGuide();
  expect(steps().getByText('tall')).toBeInTheDocument();
  expect(steps().getByText(/34 squares across, 48 down/)).toBeInTheDocument();
  expect(steps().getByText('15 squares')).toBeInTheDocument();
  expect(steps().getByText('22 squares')).toBeInTheDocument();
  expect(steps().getByText('P23')).toBeInTheDocument();
  expect(steps().getByText('4 × 4')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Crypt on a 34 by 48 square mat' })).toBeInTheDocument();
});

test('turning the mat wide re-centers the map and relabels the columns', () => {
  renderGuide();
  expect(sheetText()).not.toContain('AV');

  fireEvent.click(screen.getByRole('button', { name: 'Landscape' }));

  expect(screen.getByRole('button', { name: 'Landscape' })).toHaveAttribute('aria-pressed', 'true');
  expect(steps().getByText('wide')).toBeInTheDocument();
  expect(steps().getByText('W16')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Crypt on a 48 by 34 square mat' })).toBeInTheDocument();
  expect(sheetText()).toContain('AV');
});

test('a typed mat size applies on Enter', () => {
  renderGuide();
  const side = screen.getByRole('spinbutton', { name: 'Mat squares, one side' });
  const other = screen.getByRole('spinbutton', { name: 'Mat squares, other side' });

  fireEvent.change(side, { target: { value: '20' } });
  expect(steps().getByText('P23')).toBeInTheDocument();
  fireEvent.change(other, { target: { value: '20' } });
  fireEvent.keyDown(other, { key: 'Enter' });

  expect(steps().getByText('I9')).toBeInTheDocument();
  expect(steps().getByText(/Lay the mat out/)).toHaveTextContent('Lay the mat out: 20 squares each way.');
  expect(screen.getByRole('img', { name: 'Crypt on a 20 by 20 square mat' })).toBeInTheDocument();
});

test('the close-up shows just the map and its margin, still in mat coordinates', () => {
  renderGuide();
  expect(axisLabels()).toBe(2 * 34 + 2 * 48);

  fireEvent.click(screen.getByRole('button', { name: 'Close-up' }));

  // The 4 x 4 map at P23 plus two squares each side: columns N..U, rows 21..28.
  expect(screen.getByRole('img', { name: 'Crypt on a 34 by 48 square mat, close-up' })).toBeInTheDocument();
  expect(axisLabels()).toBe(2 * 8 + 2 * 8);
  expect(sheetText()).toContain('N');
  expect(sheetText()).not.toContain('M');
  expect(sheetText()).toContain('28');
  expect(sheetText()).not.toContain('29');
});

test('a venue too big for one mat is drawn a section at a time', () => {
  const corridor = venueWith({
    width: 60,
    height: 4,
    cells: fill('floor', 0, 0, 59, 0),
    features: [
      { id: 'w', kind: 'well', x: 3, y: 0, rotation: 0, label: '', gm_only: false },
      { id: 't', kind: 'tree', x: 40, y: 0, rotation: 0, label: '', gm_only: false },
    ],
  });
  const container = document.body;
  renderGuide(corridor);

  const sections = screen.getByRole('group', { name: 'Sections' });
  expect(within(sections).getAllByRole('button')).toHaveLength(2);
  expect(steps().getByText('Section 1 of 2')).toBeInTheDocument();
  expect(steps().getByText(/venue squares A1 to AD1/)).toBeInTheDocument();
  expect(container.querySelector('.mat-feature[data-kind="well"]')).not.toBeNull();
  expect(container.querySelector('.mat-feature[data-kind="tree"]')).toBeNull();
  expect(container.querySelectorAll('.mat-continues path')).toHaveLength(1);

  fireEvent.click(within(sections).getByRole('button', { name: 'Section 2' }));

  expect(steps().getByText('Section 2 of 2')).toBeInTheDocument();
  expect(steps().getByText(/venue squares AE1 to BH1/)).toBeInTheDocument();
  expect(container.querySelector('.mat-feature[data-kind="well"]')).toBeNull();
  expect(container.querySelector('.mat-feature[data-kind="tree"]')).not.toBeNull();
});

test('the key lists only the marks this venue uses', () => {
  const venue = venueWith({
    cells: fill('water', 3, 3, 4, 4, fill('floor', 2, 2, 6, 6)),
    edges: [{ x: 4, y: 2, side: 'n', kind: 'secret_door' }],
    features: [
      { id: 'a', kind: 'trap', x: 5, y: 5, rotation: 0, label: '', gm_only: true },
      { id: 'b', kind: 'tree', x: 2, y: 5, rotation: 0, label: '', gm_only: false },
    ],
  });
  renderGuide(venue);

  const key = screen.getByRole('region', { name: 'Key' });
  const labels = within(key).getAllByRole('listitem').map((item) => item.querySelector('.mat-guide-key-label').textContent);
  expect(labels).toEqual(['Water', 'Wall', 'Secret door', 'Trap', 'Tree', 'GM only']);
  expect(within(key).getByText('GM only — draw as wall')).toBeInTheDocument();
  expect(within(key).queryByText('Grass')).not.toBeInTheDocument();
});

test('an empty venue says so instead of giving steps', () => {
  renderGuide(venueWith());
  expect(steps().getByText(/This venue is empty/)).toBeInTheDocument();
  expect(screen.getByText('Nothing to draw yet.')).toBeInTheDocument();
});

test('Print prints, and Escape, the close button, and the backdrop close', () => {
  const originalPrint = window.print;
  window.print = jest.fn();
  try {
    const { dialog, onClose } = renderGuide();
    expect(document.body).toHaveClass('mat-guide-open');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Print' }));
    expect(window.print).toHaveBeenCalledTimes(1);

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    fireEvent.click(document.querySelector('.mat-guide-overlay'));
    expect(onClose).toHaveBeenCalledTimes(3);
  } finally {
    window.print = originalPrint;
  }
});

test('unmounting the guide clears the print isolation class', () => {
  const { unmount } = render(<MatGuide venue={crypt()} onClose={jest.fn()} />);
  expect(document.body).toHaveClass('mat-guide-open');
  unmount();
  expect(document.body).not.toHaveClass('mat-guide-open');
});

test('the mat sheet draws walls, secret marks, ringed GM stamps, labels, and bridge planks', () => {
  let cells = fill('floor', 2, 2, 6, 6);
  cells = fill('bridge', 8, 4, 11, 4, cells);
  const venue = venueWith({
    cells,
    edges: [{ x: 4, y: 2, side: 'n', kind: 'secret_door' }],
    features: [
      { id: 'a', kind: 'trap', x: 5, y: 5, rotation: 0, label: '', gm_only: true },
      { id: 'b', kind: 'label', x: 3, y: 3, rotation: 0, label: 'Chapel', gm_only: false },
      { id: 'c', kind: 'label', x: 4, y: 4, rotation: 0, label: '   ', gm_only: false },
    ],
  });
  const plan = planMat(venue);
  const { container } = render(<MatSheet venue={venue} plan={plan} section={plan.sections[0]} />);

  expect(container.querySelector('.mat-walls').getAttribute('d')).not.toBe('');
  expect(container.querySelector('.mat-secret').textContent).toBe('S');
  expect(container.querySelector('.mat-feature.gm-only[data-kind="trap"] circle')).not.toBeNull();
  expect(container.querySelectorAll('.mat-feature[data-kind="label"]')).toHaveLength(1);
  expect(container.querySelector('.mat-feature[data-kind="label"]').textContent).toContain('Chapel');
  expect(container.querySelector('[data-terrain="floor"]')).toBeNull();
  const bridge = container.querySelector('[data-terrain="bridge"]');
  expect(bridge).not.toBeNull();
  expect(bridge.querySelector('path[stroke-width="1.6"]').getAttribute('d')).toMatch(/^M/);
  expect(container.querySelectorAll('.mat-continues path')).toHaveLength(0);
});
