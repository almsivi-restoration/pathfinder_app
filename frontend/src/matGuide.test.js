/**
 * Mat Guide layout: content bounds, centering on the 32 x 46 table mat, orientation choice,
 * splitting oversize venues into sections, and a legend of only what is used.
 */
import { MAT_COLORS, VENUE_EDGE_KINDS, VENUE_FEATURES, VENUE_TERRAINS } from './venueCatalog';
import { contentBounds, clampMatSide, matLegend, planksSegments, planMat, MAT_DEFAULT_SIZE } from './matGuide';
import { paintCells, rectCells } from './venueGeometry';

const blank = (width, height) => ({
  id: 'v', name: 'Test', grid: 'square', width, height, cells: {}, edges: [], features: [],
});
const room = (venue, terrain, x0, y0, x1, y1) => paintCells(venue, rectCells(x0, y0, x1, y1), terrain);
const MAT_FILLS = ['none', 'dots', 'hatch', 'solid', 'planks'];

test('every catalog piece can be drawn with the four mat markers', () => {
  VENUE_TERRAINS.forEach((terrain) => {
    expect(Object.keys(MAT_COLORS)).toContain(terrain.mat.color);
    expect(MAT_FILLS).toContain(terrain.mat.fill);
    expect(terrain.mat.hint).toBeTruthy();
  });
  VENUE_EDGE_KINDS.forEach((kind) => expect(Object.keys(MAT_COLORS)).toContain(kind.mat.color));
  VENUE_FEATURES.forEach((feature) => {
    expect(Object.keys(MAT_COLORS)).toContain(feature.mat.color);
    expect(feature.mat.glyph).toBeTruthy();
  });
});

describe('contentBounds', () => {
  it('is null for an empty venue', () => {
    expect(contentBounds(blank(10, 10))).toBeNull();
  });

  it('wraps cells, stamps, and drawn edges but not openings', () => {
    let venue = room(blank(30, 30), 'floor', 4, 5, 8, 9);
    venue = {
      ...venue,
      features: [{ id: 'f', kind: 'chest', x: 12, y: 2, rotation: 0, label: '', gm_only: false }],
      edges: [
        { x: 2, y: 20, side: 'w', kind: 'wall' },
        { x: 25, y: 25, side: 'n', kind: 'opening' },
      ],
    };
    expect(contentBounds(venue)).toEqual({ x0: 2, y0: 2, x1: 13, y1: 21 });
  });

  it('gives a lone wall one square of depth', () => {
    const venue = { ...blank(10, 10), edges: [{ x: 3, y: 10, side: 'n', kind: 'wall' }] };
    expect(contentBounds(venue)).toEqual({ x0: 3, y0: 9, x1: 4, y1: 10 });
  });
});

describe('planMat', () => {
  it('centers a small venue on the portrait mat and counts the blank squares', () => {
    const venue = room(blank(40, 40), 'floor', 10, 10, 19, 29); // 10 wide, 20 tall
    const plan = planMat(venue);
    expect(plan).toMatchObject({ orientation: 'portrait', columns: 32, rows: 46, empty: false });
    expect(plan.sections).toHaveLength(1);
    expect(plan.sections[0]).toMatchObject({ x0: 10, y0: 10, width: 10, height: 20, left: 11, top: 13 });
  });

  it('turns the mat for a wide venue and keeps the size order-insensitive', () => {
    const venue = room(blank(60, 30), 'floor', 0, 0, 39, 19); // 40 x 20: only fits landscape
    expect(planMat(venue).orientation).toBe('landscape');
    const swapped = planMat(venue, { columns: 46, rows: 32 }, 'auto');
    expect(swapped).toMatchObject({ orientation: 'landscape', columns: 46, rows: 32 });
    expect(swapped.sections[0]).toMatchObject({ left: 3, top: 6 });
  });

  it('obeys an explicit orientation even when it needs more sections', () => {
    const venue = room(blank(60, 30), 'floor', 0, 0, 39, 19);
    const plan = planMat(venue, MAT_DEFAULT_SIZE, 'portrait');
    expect(plan.orientation).toBe('portrait');
    expect(plan.sections.map(({ x0, x1 }) => [x0, x1])).toEqual([[0, 20], [20, 40]]);
  });

  it('splits an oversize venue into even sections in reading order', () => {
    const venue = room(blank(100, 100), 'cave', 0, 0, 69, 59); // 70 x 60
    const plan = planMat(venue, MAT_DEFAULT_SIZE, 'landscape'); // 46 x 32 squares
    expect(plan.sections).toHaveLength(4);
    expect(plan.sections.map(({ x0, x1, y0, y1 }) => [x0, x1, y0, y1])).toEqual([
      [0, 35, 0, 30], [35, 70, 0, 30], [0, 35, 30, 60], [35, 70, 30, 60],
    ]);
    expect(plan.sections[0].continues).toEqual({ left: false, right: true, up: false, down: true });
    expect(plan.sections[3].continues).toEqual({ left: true, right: false, up: true, down: false });
  });

  it('plans an empty venue as its whole grid', () => {
    const plan = planMat(blank(20, 10));
    expect(plan.empty).toBe(true);
    expect(plan.sections[0]).toMatchObject({ x0: 0, y0: 0, width: 20, height: 10 });
  });

  it.each([
    [46, 32, 1],
    [32, 46, 1],
    [47, 32, 2],
    [46, 33, 2],
    [48, 34, 2],
  ])('plans a %i by %i venue into %i sections on the usable mat', (width, height, count) => {
    const venue = room(blank(width, height), 'floor', 0, 0, width - 1, height - 1);
    const plan = planMat(venue);
    expect(plan.sections).toHaveLength(count);
    plan.sections.forEach((section) => {
      expect(section.left + section.width).toBeLessThanOrEqual(plan.columns);
      expect(section.top + section.height).toBeLessThanOrEqual(plan.rows);
    });
    expect(venue.width).toBe(width);
    expect(venue.height).toBe(height);
  });

  it('uses four sections for the old whole-mat size when held landscape', () => {
    const plan = planMat(blank(48, 34), MAT_DEFAULT_SIZE, 'landscape');
    expect(plan.sections).toHaveLength(4);
  });

  it('clamps typed mat sizes', () => {
    expect(clampMatSide('2', 34)).toBe(4);
    expect(clampMatSide('400', 34)).toBe(100);
    expect(clampMatSide('', 34)).toBe(34);
  });
});

describe('planksSegments', () => {
  it('draws boards across each bridge, whichever way it runs', () => {
    let venue = room(blank(10, 10), 'bridge', 1, 1, 3, 1); // east-west, 3 long
    venue = room(venue, 'bridge', 6, 4, 6, 5); // north-south, 2 long
    const segments = planksSegments(venue, 'bridge');
    expect(segments).toHaveLength(10);
    const vertical = segments.filter(({ x1, x2 }) => x1 === x2);
    const horizontal = segments.filter(({ y1, y2 }) => y1 === y2);
    expect(vertical).toHaveLength(6);
    vertical.forEach(({ y1, y2 }) => expect([y1, y2]).toEqual([1, 2]));
    expect(horizontal).toHaveLength(4);
    horizontal.forEach(({ x1, x2 }) => expect([x1, x2]).toEqual([6, 7]));
  });
});

describe('matLegend', () => {
  it('lists only the marks this venue uses', () => {
    let venue = room(blank(20, 20), 'floor', 1, 1, 6, 6);
    venue = room(venue, 'water', 2, 2, 3, 3);
    venue = {
      ...venue,
      edges: [{ x: 3, y: 1, side: 'n', kind: 'secret_door' }],
      features: [
        { id: 'a', kind: 'trap', x: 4, y: 4, rotation: 0, label: '', gm_only: true },
        { id: 'b', kind: 'tree', x: 5, y: 5, rotation: 0, label: '', gm_only: false },
        { id: 'c', kind: 'tree', x: 1, y: 5, rotation: 0, label: '', gm_only: false },
        { id: 'd', kind: 'label', x: 1, y: 1, rotation: 0, label: '  ', gm_only: false },
      ],
    };
    const legend = matLegend(venue);
    expect(legend.map((entry) => entry.key)).toEqual([
      'terrain:water', 'edge:wall', 'edge:secret_door', 'feature:trap', 'feature:tree', 'gm-only',
    ]);
    expect(legend.find((entry) => entry.id === 'water')).toMatchObject({ color: 'blue', fill: 'hatch' });
    expect(legend.find((entry) => entry.id === 'tree')).toMatchObject({ color: 'green', glyph: 'T', hint: 'Write T' });
    // A stamp whose mat mark is a shape, not letters, says what to draw.
    const pillars = { ...venue, features: [...venue.features, { id: 'p1', kind: 'pillar', x: 0, y: 0, rotation: 0, label: '', gm_only: false }] };
    expect(matLegend(pillars).find((entry) => entry.id === 'pillar')).toMatchObject({ glyph: '●', hint: 'Fill in a dot' });
  });

  it('includes labels only once one has text', () => {
    const venue = {
      ...room(blank(5, 5), 'floor', 0, 0, 2, 2),
      features: [{ id: 'l', kind: 'label', x: 1, y: 1, rotation: 0, label: 'Chapel', gm_only: false }],
    };
    expect(matLegend(venue).find((entry) => entry.id === 'label')).toMatchObject({ hint: 'Write the label' });
  });
});
