// Pure venue geometry and editing operations. Every edit returns a new venue object, or the
// same object when nothing changed, so undo history and dirty-tracking can compare identity.
import { getTerrain } from './venueCatalog';

export const VENUE_MAX_SIDE = 100; // backend models.VENUE_MAX_SIDE

export const cellKey = (x, y) => `${x},${y}`;
export const parseCellKey = (key) => key.split(',').map(Number);
const edgeId = (x, y, side) => `${x},${y},${side}`;

// Mat-style coordinates: columns A, B, ... Z, AA, AB ...; rows 1-based.
export function columnLabel(index) {
  let label = '';
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}
export const cellLabel = (x, y) => `${columnLabel(x)}${y + 1}`;

export const inBounds = (venue, x, y) => x >= 0 && y >= 0 && x < venue.width && y < venue.height;

export function isEdgeInBounds(venue, x, y, side) {
  if (side === 'n') return x >= 0 && x < venue.width && y >= 0 && y <= venue.height;
  return x >= 0 && x <= venue.width && y >= 0 && y < venue.height;
}

function surfaceAt(venue, x, y) {
  if (!inBounds(venue, x, y)) return 'outside';
  const terrain = venue.cells[cellKey(x, y)];
  return terrain ? getTerrain(terrain).surface : 'void';
}

// See the surface notes in venueCatalog: indoor walls against void/border/outdoor,
// neutral (water, rubble, chasm) only against void, outdoor never.
function walledAgainst(surface, other) {
  if (surface === 'indoor') return other === 'void' || other === 'outside' || other === 'outdoor';
  if (surface === 'neutral') return other === 'void';
  return false;
}

// The two cells a grid line separates: [before, after].
const edgeCells = (x, y, side) => (side === 'n' ? [[x, y - 1], [x, y]] : [[x - 1, y], [x, y]]);

export function isDerivedWall(venue, x, y, side) {
  const [[ax, ay], [bx, by]] = edgeCells(x, y, side);
  const a = surfaceAt(venue, ax, ay);
  const b = surfaceAt(venue, bx, by);
  return walledAgainst(a, b) || walledAgainst(b, a);
}

export const edgeSegment = (x, y, side) => (
  side === 'n' ? { x1: x, y1: y, x2: x + 1, y2: y } : { x1: x, y1: y, x2: x, y2: y + 1 }
);

const explicitEdgeIndex = (venue) => new Map(venue.edges.map((edge) => [edgeId(edge.x, edge.y, edge.side), edge]));

export function explicitEdgeAt(venue, x, y, side) {
  return venue.edges.find((edge) => edge.x === x && edge.y === y && edge.side === side) || null;
}

// What is drawn on a grid line: an explicit edge wins over the derived wall.
// Players never see a secret door; it is drawn as the wall it pretends to be.
export function resolveEdges(venue, mode = 'gm') {
  const explicit = explicitEdgeIndex(venue);
  const walls = [];
  const doors = [];
  const secretDoors = [];
  const visit = (x, y, side) => {
    const edge = explicit.get(edgeId(x, y, side));
    let kind = edge ? edge.kind : (isDerivedWall(venue, x, y, side) ? 'wall' : null);
    if (kind === 'secret_door' && mode === 'player') kind = 'wall';
    if (!kind || kind === 'opening') return;
    if (kind === 'door') {
      doors.push({ x, y, side });
    } else if (kind === 'secret_door') {
      secretDoors.push({ x, y, side });
      walls.push(edgeSegment(x, y, side));
    } else {
      walls.push(edgeSegment(x, y, side)); // wall, and any unknown kind from a newer catalog
    }
  };
  for (let y = 0; y <= venue.height; y += 1) {
    for (let x = 0; x < venue.width; x += 1) visit(x, y, 'n');
  }
  for (let y = 0; y < venue.height; y += 1) {
    for (let x = 0; x <= venue.width; x += 1) visit(x, y, 'w');
  }
  return { walls: mergeSegments(walls), doors, secretDoors };
}

// Join touching collinear unit segments so long walls render as single strokes.
export function mergeSegments(segments) {
  const horizontal = new Map();
  const vertical = new Map();
  for (const segment of segments) {
    if (segment.y1 === segment.y2) {
      if (!horizontal.has(segment.y1)) horizontal.set(segment.y1, []);
      horizontal.get(segment.y1).push([Math.min(segment.x1, segment.x2), Math.max(segment.x1, segment.x2)]);
    } else {
      if (!vertical.has(segment.x1)) vertical.set(segment.x1, []);
      vertical.get(segment.x1).push([Math.min(segment.y1, segment.y2), Math.max(segment.y1, segment.y2)]);
    }
  }
  const merged = [];
  const collapse = (spans, emit) => {
    spans.sort((a, b) => a[0] - b[0]);
    let [start, end] = spans[0];
    for (const [nextStart, nextEnd] of spans.slice(1)) {
      if (nextStart <= end) {
        end = Math.max(end, nextEnd);
      } else {
        emit(start, end);
        [start, end] = [nextStart, nextEnd];
      }
    }
    emit(start, end);
  };
  horizontal.forEach((spans, y) => collapse(spans, (x1, x2) => merged.push({ x1, y1: y, x2, y2: y })));
  vertical.forEach((spans, x) => collapse(spans, (y1, y2) => merged.push({ x1: x, y1, x2: x, y2 })));
  return merged;
}

export const segmentsPath = (segments, size) => segments
  .map(({ x1, y1, x2, y2 }) => `M${x1 * size} ${y1 * size}L${x2 * size} ${y2 * size}`)
  .join('');

// Union of cells as one path of row runs (fill-rule nonzero merges them).
export function cellsPath(keys, size) {
  const rows = new Map();
  for (const key of keys) {
    const [x, y] = parseCellKey(key);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(x);
  }
  const parts = [];
  rows.forEach((xs, y) => {
    xs.sort((a, b) => a - b);
    let start = xs[0];
    let previous = xs[0];
    const emit = () => parts.push(`M${start * size} ${y * size}h${(previous - start + 1) * size}v${size}h${-(previous - start + 1) * size}z`);
    for (const x of xs.slice(1)) {
      if (x !== previous + 1) {
        emit();
        start = x;
      }
      previous = x;
    }
    emit();
  });
  return parts.join('');
}

// Outline of one terrain's region (e.g. a shoreline), as merged segments.
export function terrainOutline(venue, terrain) {
  const segments = [];
  const same = (x, y) => venue.cells[cellKey(x, y)] === terrain;
  for (const [key, value] of Object.entries(venue.cells)) {
    if (value !== terrain) continue;
    const [x, y] = parseCellKey(key);
    if (!same(x, y - 1)) segments.push(edgeSegment(x, y, 'n'));
    if (!same(x, y + 1)) segments.push(edgeSegment(x, y + 1, 'n'));
    if (!same(x - 1, y)) segments.push(edgeSegment(x, y, 'w'));
    if (!same(x + 1, y)) segments.push(edgeSegment(x + 1, y, 'w'));
  }
  return mergeSegments(segments);
}

export function rectCells(x0, y0, x1, y1) {
  const cells = [];
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) cells.push([x, y]);
  }
  return cells;
}

// Cells crossed moving from a to b (in cell units), so fast drags leave no gaps.
export function cellsAlong(ax, ay, bx, by) {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 4));
  const seen = new Set();
  const cells = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.floor(ax + ((bx - ax) * i) / steps);
    const y = Math.floor(ay + ((by - ay) * i) / steps);
    const key = cellKey(x, y);
    if (!seen.has(key)) {
      seen.add(key);
      cells.push([x, y]);
    }
  }
  return cells;
}

// Whether either cell beside a grid line holds terrain (doors need something to open into).
export function edgeTouchesTerrain(venue, x, y, side) {
  const [[ax, ay], [bx, by]] = edgeCells(x, y, side);
  return Boolean(venue.cells[cellKey(ax, ay)] || venue.cells[cellKey(bx, by)]);
}

// An explicit edge with empty space on both sides is meaningless; drop it after erasing.
function pruneEdges(venue) {
  const edges = venue.edges.filter((edge) => edgeTouchesTerrain(venue, edge.x, edge.y, edge.side));
  return edges.length === venue.edges.length ? venue : { ...venue, edges };
}

// terrain null erases. Erasing also removes stamps on the erased cells.
export function paintCells(venue, cells, terrain) {
  const next = { ...venue.cells };
  let changed = false;
  const erased = new Set();
  for (const [x, y] of cells) {
    if (!inBounds(venue, x, y)) continue;
    const key = cellKey(x, y);
    if (terrain) {
      if (next[key] !== terrain) {
        next[key] = terrain;
        changed = true;
      }
    } else {
      erased.add(key);
      if (key in next) {
        delete next[key];
        changed = true;
      }
    }
  }
  const features = erased.size
    ? venue.features.filter((feature) => !erased.has(cellKey(feature.x, feature.y)))
    : venue.features;
  if (!changed && features.length === venue.features.length) return venue;
  const painted = { ...venue, cells: changed ? next : venue.cells, features };
  return terrain ? painted : pruneEdges(painted);
}

export function setEdge(venue, x, y, side, kind) {
  if (!isEdgeInBounds(venue, x, y, side)) return venue;
  const current = explicitEdgeAt(venue, x, y, side);
  if ((current?.kind || null) === (kind || null)) return venue;
  const edges = venue.edges.filter((edge) => !(edge.x === x && edge.y === y && edge.side === side));
  if (kind) edges.push({ x, y, side, kind });
  return { ...venue, edges };
}

export function showsWall(venue, x, y, side) {
  const explicit = explicitEdgeAt(venue, x, y, side);
  if (explicit) return explicit.kind !== 'opening';
  return isDerivedWall(venue, x, y, side);
}

// Make a grid line show (or not show) a wall with the fewest explicit edges.
export function applyWall(venue, x, y, side, wantWall) {
  const derived = isDerivedWall(venue, x, y, side);
  const kind = wantWall ? (derived ? null : 'wall') : (derived ? 'opening' : null);
  return setEdge(venue, x, y, side, kind);
}

// Door tools toggle: placing the same kind again returns the line to its derived state.
export function toggleEdgeKind(venue, x, y, side, kind) {
  const current = explicitEdgeAt(venue, x, y, side);
  return setEdge(venue, x, y, side, current?.kind === kind ? null : kind);
}

// Nearest grid line to a point given in cell units.
export function nearestEdge(venue, px, py) {
  const cx = Math.min(Math.max(px, 0), venue.width - 1e-6);
  const cy = Math.min(Math.max(py, 0), venue.height - 1e-6);
  const x = Math.floor(cx);
  const y = Math.floor(cy);
  const fx = cx - x;
  const fy = cy - y;
  const options = [
    { distance: fy, x, y, side: 'n' },
    { distance: 1 - fy, x, y: y + 1, side: 'n' },
    { distance: fx, x, y, side: 'w' },
    { distance: 1 - fx, x: x + 1, y, side: 'w' },
  ];
  const { distance, ...edge } = options.reduce((best, option) => (option.distance < best.distance ? option : best));
  return edge;
}

// Grid lines along a straight, axis-locked drag from a to b (cell units).
export function edgesAlongLine(venue, ax, ay, bx, by) {
  const edges = [];
  if (Math.abs(bx - ax) >= Math.abs(by - ay)) {
    const y = Math.min(Math.max(Math.round(ay), 0), venue.height);
    const from = Math.max(0, Math.floor(Math.min(ax, bx)));
    const to = Math.min(venue.width - 1, Math.floor(Math.max(ax, bx)));
    for (let x = from; x <= to; x += 1) edges.push({ x, y, side: 'n' });
  } else {
    const x = Math.min(Math.max(Math.round(ax), 0), venue.width);
    const from = Math.max(0, Math.floor(Math.min(ay, by)));
    const to = Math.min(venue.height - 1, Math.floor(Math.max(ay, by)));
    for (let y = from; y <= to; y += 1) edges.push({ x, y, side: 'w' });
  }
  return edges;
}

let featureCounter = 0;
export function newFeatureId() {
  featureCounter += 1;
  return `f${Date.now().toString(36)}${featureCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Topmost (last drawn) stamp on a cell.
export function featureAt(venue, x, y) {
  for (let i = venue.features.length - 1; i >= 0; i -= 1) {
    if (venue.features[i].x === x && venue.features[i].y === y) return venue.features[i];
  }
  return null;
}

export function addFeature(venue, feature) {
  if (!inBounds(venue, feature.x, feature.y)) return venue;
  return {
    ...venue,
    features: [...venue.features, { rotation: 0, label: '', gm_only: false, id: newFeatureId(), ...feature }],
  };
}

export function updateFeature(venue, featureId, patch) {
  let changed = false;
  const features = venue.features.map((feature) => {
    if (feature.id !== featureId) return feature;
    const next = { ...feature, ...patch };
    if (!inBounds(venue, next.x, next.y)) return feature;
    changed = Object.keys(patch).some((key) => patch[key] !== feature[key]);
    return changed ? next : feature;
  });
  return changed ? { ...venue, features } : venue;
}

export function removeFeature(venue, featureId) {
  const features = venue.features.filter((feature) => feature.id !== featureId);
  return features.length === venue.features.length ? venue : { ...venue, features };
}

export const rotateBy = (rotation, step) => (((rotation + step) % 360) + 360) % 360;

// Change the grid size; anything that falls outside the new bounds is cropped.
export function resizeVenue(venue, width, height) {
  if (width === venue.width && height === venue.height) return venue;
  const sized = { ...venue, width, height };
  const cells = Object.fromEntries(
    Object.entries(venue.cells).filter(([key]) => {
      const [x, y] = parseCellKey(key);
      return x < width && y < height;
    }),
  );
  return pruneEdges({
    ...sized,
    cells,
    edges: venue.edges.filter((edge) => isEdgeInBounds(sized, edge.x, edge.y, edge.side)),
    features: venue.features.filter((feature) => inBounds(sized, feature.x, feature.y)),
  });
}
