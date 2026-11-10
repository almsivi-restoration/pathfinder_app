// Mat Guide layout: where a venue lands on the physical dry-erase table mat, counted in
// one-inch mat squares. Pure functions; MatGuide/MatSheet render what these return.
import { getEdgeKind, getFeature, getTerrain } from './venueCatalog';
import { cellKey, parseCellKey, resolveEdges } from './venueGeometry';

// The table's 34.5" x 48" one-inch grid mat: 34 whole squares by 48.
export const MAT_DEFAULT_SIZE = { columns: 34, rows: 48 };
export const MAT_MIN_SIDE = 4;
export const MAT_MAX_SIDE = 100;
export const MAT_ORIENTATIONS = ['auto', 'portrait', 'landscape'];

// Extent of everything drawn, in grid-line coordinates (cell x spans lines x..x+1).
// Openings draw nothing, so they never stretch the footprint. Null for an empty venue.
export function contentBounds(venue) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const include = (ax, ay, bx, by) => {
    x0 = Math.min(x0, ax);
    y0 = Math.min(y0, ay);
    x1 = Math.max(x1, bx);
    y1 = Math.max(y1, by);
  };
  Object.keys(venue.cells).forEach((key) => {
    const [x, y] = parseCellKey(key);
    include(x, y, x + 1, y + 1);
  });
  venue.features.forEach(({ x, y }) => include(x, y, x + 1, y + 1));
  venue.edges.forEach(({ x, y, side, kind }) => {
    if (kind === 'opening') return;
    if (side === 'n') include(x, y, x + 1, y);
    else include(x, y, x, y + 1);
  });
  if (x0 === Infinity) return null;
  // A lone wall is a line, not an area; give it one square of depth on the mat.
  if (x1 - x0 < 1) [x0, x1] = x1 < venue.width ? [x0, x1 + 1] : [x0 - 1, x1];
  if (y1 - y0 < 1) [y0, y1] = y1 < venue.height ? [y0, y1 + 1] : [y0 - 1, y1];
  return { x0, y0, x1, y1 };
}

export function clampMatSide(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, MAT_MIN_SIDE), MAT_MAX_SIDE);
}

// Split a span into `pieces` near-equal runs, larger runs first.
function splitSpan(start, span, pieces) {
  const base = Math.floor(span / pieces);
  const extra = span % pieces;
  const runs = [];
  let cursor = start;
  for (let index = 0; index < pieces; index += 1) {
    const size = base + (index < extra ? 1 : 0);
    runs.push([cursor, cursor + size]);
    cursor += size;
  }
  return runs;
}

// The size is order-insensitive (34 x 48 and 48 x 34 are the same mat); orientation decides
// which side runs across. "auto" picks whichever needs fewer sections, then the one matching
// the venue's shape.
export function planMat(venue, size = MAT_DEFAULT_SIZE, orientation = 'auto') {
  const found = contentBounds(venue);
  const bounds = found || { x0: 0, y0: 0, x1: venue.width, y1: venue.height };
  const width = bounds.x1 - bounds.x0;
  const height = bounds.y1 - bounds.y0;
  const short = Math.min(size.columns, size.rows);
  const long = Math.max(size.columns, size.rows);

  const layout = (name) => {
    const columns = name === 'portrait' ? short : long;
    const rows = name === 'portrait' ? long : short;
    return { orientation: name, columns, rows, across: Math.ceil(width / columns), down: Math.ceil(height / rows) };
  };
  let chosen;
  if (orientation === 'portrait' || orientation === 'landscape') {
    chosen = layout(orientation);
  } else {
    const portrait = layout('portrait');
    const landscape = layout('landscape');
    const portraitCount = portrait.across * portrait.down;
    const landscapeCount = landscape.across * landscape.down;
    if (portraitCount !== landscapeCount) chosen = portraitCount < landscapeCount ? portrait : landscape;
    else chosen = width > height ? landscape : portrait;
  }

  const columnRuns = splitSpan(bounds.x0, width, chosen.across);
  const rowRuns = splitSpan(bounds.y0, height, chosen.down);
  const sections = [];
  rowRuns.forEach(([sy0, sy1], row) => {
    columnRuns.forEach(([sx0, sx1], column) => {
      const sectionWidth = sx1 - sx0;
      const sectionHeight = sy1 - sy0;
      sections.push({
        index: sections.length,
        row,
        column,
        x0: sx0,
        y0: sy0,
        x1: sx1,
        y1: sy1,
        width: sectionWidth,
        height: sectionHeight,
        // Whole squares left blank between the mat's left/top edge and the map.
        left: Math.floor((chosen.columns - sectionWidth) / 2),
        top: Math.floor((chosen.rows - sectionHeight) / 2),
        continues: {
          left: column > 0,
          right: column < chosen.across - 1,
          up: row > 0,
          down: row < chosen.down - 1,
        },
      });
    });
  });

  return {
    orientation: chosen.orientation,
    columns: chosen.columns,
    rows: chosen.rows,
    empty: !found,
    bounds,
    sections,
  };
}

// Plank lines for a "planks" terrain, in cell units: each connected stretch (a bridge, a dock)
// gets two lines per square running across its long axis, the way you would draw the boards.
export function planksSegments(venue, terrainId) {
  const keys = Object.keys(venue.cells).filter((key) => venue.cells[key] === terrainId);
  const unvisited = new Set(keys);
  const segments = [];
  keys.forEach((start) => {
    if (!unvisited.has(start)) return;
    unvisited.delete(start);
    const component = [];
    const queue = [start];
    while (queue.length) {
      const [x, y] = parseCellKey(queue.pop());
      component.push([x, y]);
      [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].forEach(([nx, ny]) => {
        const key = cellKey(nx, ny);
        if (unvisited.has(key)) {
          unvisited.delete(key);
          queue.push(key);
        }
      });
    }
    const xs = component.map(([x]) => x);
    const ys = component.map(([, y]) => y);
    const runsAcross = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
    component.forEach(([x, y]) => {
      [1 / 3, 2 / 3].forEach((offset) => {
        segments.push(runsAcross
          ? { x1: x + offset, y1: y, x2: x + offset, y2: y + 1 }
          : { x1: x, y1: y + offset, x2: x + 1, y2: y + offset });
      });
    });
  });
  return segments;
}

// Only what this venue actually uses, in drawing order: terrain fills, lines, then stamps.
// Blank-on-the-mat terrain is left out; the guide says "everything else stays blank".
export function matLegend(venue) {
  const entries = [];
  const terrainIds = [...new Set(Object.values(venue.cells))];
  terrainIds
    .map((id) => getTerrain(id))
    .filter((terrain) => terrain.mat.fill !== 'none')
    .forEach((terrain) => entries.push({
      key: `terrain:${terrain.id}`,
      type: 'terrain',
      id: terrain.id,
      label: terrain.label,
      color: terrain.mat.color,
      fill: terrain.mat.fill,
      hint: terrain.mat.hint,
    }));

  const edges = resolveEdges(venue, 'gm');
  const lines = [
    ['wall', edges.walls.length > 0],
    ['door', edges.doors.length > 0],
    ['secret_door', edges.secretDoors.length > 0],
  ];
  lines.filter(([, used]) => used).forEach(([id]) => {
    const kind = getEdgeKind(id);
    entries.push({ key: `edge:${id}`, type: 'edge', id, label: kind.label, color: kind.mat.color, hint: kind.mat.hint });
  });

  const seen = new Set();
  venue.features.forEach((feature) => {
    if (seen.has(feature.kind)) return;
    const definition = getFeature(feature.kind);
    if (definition.text && !venue.features.some((entry) => entry.kind === feature.kind && entry.label?.trim())) return;
    seen.add(feature.kind);
    entries.push({
      key: `feature:${feature.kind}`,
      type: 'feature',
      id: feature.kind,
      label: definition.label,
      color: definition.mat.color,
      glyph: definition.mat.glyph,
      hint: definition.text ? 'Write the label' : (definition.mat.hint || `Write ${definition.mat.glyph}`),
    });
  });

  if (venue.features.some((feature) => feature.gm_only)) {
    entries.push({ key: 'gm-only', type: 'gm-only', id: 'gm-only', label: 'GM only', color: 'red', hint: "Ringed stamps: don't draw" });
  }
  return entries;
}
