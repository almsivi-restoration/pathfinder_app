import {
  applyWall,
  cellLabel,
  cellsAlong,
  cellsPath,
  columnLabel,
  edgesAlongLine,
  featureAt,
  addFeature,
  isDerivedWall,
  nearestEdge,
  paintCells,
  rectCells,
  removeFeature,
  resizeVenue,
  resolveEdges,
  rotateBy,
  showsWall,
  toggleEdgeKind,
  updateFeature,
} from './venueGeometry';
import { VENUE_TERRAINS, VENUE_FEATURES, getTerrain, getFeature } from './venueCatalog';

const blank = (width = 6, height = 6) => ({
  id: 'v', name: 'Test', grid: 'square', width, height, cells: {}, edges: [], features: [],
});

const room = (venue, terrain, x0, y0, x1, y1) => paintCells(venue, rectCells(x0, y0, x1, y1), terrain);

describe('venue catalog', () => {
  it('gives every terrain a surface and a mat hint, and every feature a drawing', () => {
    VENUE_TERRAINS.forEach((terrain) => {
      expect(['indoor', 'neutral', 'outdoor']).toContain(terrain.surface);
      expect(terrain.mat.color).toBeTruthy();
    });
    VENUE_FEATURES.forEach((feature) => {
      expect(typeof feature.draw).toBe('function');
      expect(feature.mat.color).toBeTruthy();
    });
  });

  it('falls back for ids from a newer catalog', () => {
    expect(getTerrain('lava').surface).toBe('indoor');
    expect(getFeature('portal').label).toBeTruthy();
  });
});

describe('coordinates', () => {
  it('labels columns like a spreadsheet and rows from 1', () => {
    expect(columnLabel(0)).toBe('A');
    expect(columnLabel(25)).toBe('Z');
    expect(columnLabel(26)).toBe('AA');
    expect(columnLabel(33)).toBe('AH');
    expect(cellLabel(2, 6)).toBe('C7');
  });
});

describe('derived walls', () => {
  it('walls indoor rooms against void and the map border', () => {
    const venue = room(blank(), 'floor', 1, 1, 2, 2);
    expect(isDerivedWall(venue, 1, 1, 'n')).toBe(true); // void above
    expect(isDerivedWall(venue, 1, 2, 'n')).toBe(false); // floor on both sides
    expect(isDerivedWall(venue, 3, 1, 'w')).toBe(true); // void to the right

    const edgeRoom = room(blank(), 'floor', 0, 0, 0, 0);
    expect(isDerivedWall(edgeRoom, 0, 0, 'n')).toBe(true); // map border
  });

  it('does not wall water inside a room or a pond in grass', () => {
    let venue = room(blank(), 'floor', 0, 0, 3, 3);
    venue = room(venue, 'water', 1, 1, 1, 1);
    expect(isDerivedWall(venue, 1, 1, 'n')).toBe(false);

    let field = room(blank(), 'grass', 0, 0, 3, 3);
    field = room(field, 'water', 1, 1, 1, 1);
    expect(isDerivedWall(field, 1, 1, 'w')).toBe(false);
    expect(isDerivedWall(field, 0, 0, 'n')).toBe(false); // outdoor never walls the border
  });

  it('walls a building against the grass around it', () => {
    let venue = room(blank(), 'grass', 0, 0, 5, 5);
    venue = room(venue, 'wood', 2, 2, 3, 3);
    expect(isDerivedWall(venue, 2, 2, 'n')).toBe(true);
    expect(isDerivedWall(venue, 2, 3, 'n')).toBe(false);
  });

  it('leaves a bridge between grass and water unwalled', () => {
    let venue = room(blank(), 'grass', 0, 0, 5, 2);
    venue = room(venue, 'water', 2, 0, 3, 2);
    venue = room(venue, 'bridge', 1, 1, 4, 1);
    expect(isDerivedWall(venue, 1, 1, 'w')).toBe(false); // grass bank
    expect(isDerivedWall(venue, 2, 1, 'n')).toBe(false); // water alongside
    expect(isDerivedWall(venue, 5, 1, 'w')).toBe(false); // far bank
  });
});

describe('wall and door edits', () => {
  it('stores the fewest explicit edges to add or remove a wall', () => {
    const venue = room(blank(), 'floor', 1, 1, 3, 3);
    const opened = applyWall(venue, 1, 1, 'n', false);
    expect(opened.edges).toEqual([{ x: 1, y: 1, side: 'n', kind: 'opening' }]);
    expect(showsWall(opened, 1, 1, 'n')).toBe(false);
    expect(applyWall(opened, 1, 1, 'n', true).edges).toEqual([]);

    const divided = applyWall(venue, 2, 2, 'n', true);
    expect(divided.edges).toEqual([{ x: 2, y: 2, side: 'n', kind: 'wall' }]);
    expect(applyWall(divided, 2, 2, 'n', true)).toBe(divided); // no-op keeps identity
  });

  it('toggles doors back to the derived wall', () => {
    const venue = room(blank(), 'floor', 1, 1, 3, 3);
    const withDoor = toggleEdgeKind(venue, 1, 1, 'n', 'door');
    expect(withDoor.edges).toHaveLength(1);
    expect(toggleEdgeKind(withDoor, 1, 1, 'n', 'door').edges).toEqual([]);
  });

  it('shows players secret doors as walls', () => {
    const venue = toggleEdgeKind(room(blank(), 'floor', 1, 1, 3, 3), 2, 2, 'n', 'secret_door');
    const gm = resolveEdges(venue, 'gm');
    const player = resolveEdges(venue, 'player');
    expect(gm.secretDoors).toEqual([{ x: 2, y: 2, side: 'n' }]);
    expect(player.secretDoors).toEqual([]);
    const coversSecret = (walls) => walls.some((w) => w.y1 === 2 && w.y2 === 2 && w.x1 <= 2 && w.x2 >= 3);
    expect(coversSecret(gm.walls)).toBe(true);
    expect(coversSecret(player.walls)).toBe(true);
  });

  it('merges a room perimeter into four strokes', () => {
    const { walls, doors } = resolveEdges(room(blank(), 'floor', 1, 1, 3, 2));
    expect(doors).toEqual([]);
    expect(walls).toHaveLength(4);
    expect(walls).toContainEqual({ x1: 1, y1: 1, x2: 4, y2: 1 });
    expect(walls).toContainEqual({ x1: 4, y1: 1, x2: 4, y2: 3 });
  });
});

describe('painting and erasing', () => {
  it('returns the same venue when nothing changes', () => {
    const venue = room(blank(), 'floor', 0, 0, 1, 1);
    expect(paintCells(venue, [[0, 0]], 'floor')).toBe(venue);
    expect(paintCells(venue, [[9, 9]], 'floor')).toBe(venue);
  });

  it('erasing drops stamps on the cells and edges left floating in void', () => {
    let venue = room(blank(), 'floor', 0, 0, 1, 0);
    venue = toggleEdgeKind(venue, 1, 0, 'w', 'door');
    venue = addFeature(venue, { kind: 'chest', x: 1, y: 0 });
    const erased = paintCells(venue, [[1, 0]], null);
    expect(erased.cells).toEqual({ '0,0': 'floor' });
    expect(erased.features).toEqual([]);
    expect(erased.edges).toHaveLength(1); // still has floor on one side

    const cleared = paintCells(erased, [[0, 0]], null);
    expect(cleared.edges).toEqual([]);
  });
});

describe('picking grid lines', () => {
  it('finds the nearest grid line to a point', () => {
    const venue = blank();
    expect(nearestEdge(venue, 2.5, 3.1)).toEqual({ x: 2, y: 3, side: 'n' });
    expect(nearestEdge(venue, 2.95, 3.5)).toEqual({ x: 3, y: 3, side: 'w' });
    expect(nearestEdge(venue, 5.9, 5.99)).toEqual({ x: 5, y: 6, side: 'n' }); // bottom border
  });

  it('locks a drag to one axis and clamps to the map', () => {
    const venue = blank();
    expect(edgesAlongLine(venue, 0.4, 2.1, 3.6, 2.4)).toEqual([
      { x: 0, y: 2, side: 'n' }, { x: 1, y: 2, side: 'n' }, { x: 2, y: 2, side: 'n' }, { x: 3, y: 2, side: 'n' },
    ]);
    expect(edgesAlongLine(venue, 6.2, -1, 6.1, 1.5)).toEqual([
      { x: 6, y: 0, side: 'w' }, { x: 6, y: 1, side: 'w' },
    ]);
  });

  it('fills gaps in a fast diagonal drag', () => {
    const cells = cellsAlong(0.5, 0.5, 3.5, 3.5);
    expect(cells[0]).toEqual([0, 0]);
    expect(cells[cells.length - 1]).toEqual([3, 3]);
    expect(cells.length).toBeGreaterThanOrEqual(4);
  });
});

describe('features', () => {
  it('adds, finds, moves, and removes stamps', () => {
    let venue = addFeature(blank(), { kind: 'chest', x: 1, y: 1 });
    const [chest] = venue.features;
    expect(chest).toMatchObject({ kind: 'chest', rotation: 0, gm_only: false });
    expect(featureAt(venue, 1, 1)).toBe(chest);

    venue = updateFeature(venue, chest.id, { x: 2 });
    expect(featureAt(venue, 2, 1).id).toBe(chest.id);
    expect(updateFeature(venue, chest.id, { x: 99 })).toBe(venue); // out of bounds is refused
    expect(removeFeature(venue, chest.id).features).toEqual([]);
  });

  it('rotates in quarter turns both ways', () => {
    expect(rotateBy(270, 90)).toBe(0);
    expect(rotateBy(0, -90)).toBe(270);
  });
});

describe('resizing', () => {
  it('crops cells, edges, and stamps outside the new bounds', () => {
    let venue = room(blank(6, 6), 'floor', 0, 0, 5, 5);
    venue = toggleEdgeKind(venue, 5, 2, 'w', 'door');
    venue = addFeature(venue, { kind: 'tree', x: 5, y: 5 });
    const cropped = resizeVenue(venue, 4, 4);
    expect(Object.keys(cropped.cells)).toHaveLength(16);
    expect(cropped.edges).toEqual([]);
    expect(cropped.features).toEqual([]);
    expect(resizeVenue(cropped, 4, 4)).toBe(cropped);
  });
});

describe('paths', () => {
  it('builds one run per contiguous row span', () => {
    expect(cellsPath(['0,0', '1,0', '3,0'], 10)).toBe('M0 0h20v10h-20zM30 0h10v10h-10z');
  });
});
