// Venue content catalog: every terrain, edge kind, and feature stamp a venue can hold.
// Adding a piece means adding one entry here — the renderer, editor palette, and mat guide
// all read from this file. Art colors are venue *content*, deliberately not --mw-* theme
// tokens (react-component-pair blueprint deviation): a map must look the same in every
// theme, on the Venue Screen, and when copied onto the table mat.
import React from 'react';

export const VENUE_CELL = 40; // SVG units per grid cell; every drawing below is in this scale
export const VENUE_INK = '#2b2116';
export const VENUE_PAPER = '#fbf7ec';
export const VENUE_VOID = '#e4d8bc';
export const VENUE_HATCH_INK = '#3d3124';
export const VENUE_SECRET_INK = '#a3281c';

// The four marker colors that ship with the table mat.
export const MAT_COLORS = {
  black: '#1d1d1d',
  red: '#c62828',
  green: '#2e7d32',
  blue: '#1565c0',
};

// Deterministic PRNG so patterns render identically every time (and in tests).
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Repeat an item at every tile offset where it pokes over an edge, so pattern tiles are seamless.
function wrapped(items, tile, margin) {
  const copies = [];
  for (const item of items) {
    for (const ox of [-tile, 0, tile]) {
      for (const oy of [-tile, 0, tile]) {
        const x = item.x + ox;
        const y = item.y + oy;
        if (x > -margin && x < tile + margin && y > -margin && y < tile + margin) {
          copies.push({ ...item, x, y });
        }
      }
    }
  }
  return copies;
}

const n = (value) => Math.round(value * 100) / 100;

// Rock crosshatch around walled areas: clusters of short parallel strokes at random angles.
function buildHatchPath(tile, seed) {
  const rand = seededRandom(seed);
  const clusters = [];
  const step = 11;
  for (let gy = 0; gy < tile; gy += step) {
    for (let gx = 0; gx < tile; gx += step) {
      clusters.push({
        x: gx + rand() * step,
        y: gy + rand() * step,
        angle: rand() * Math.PI,
        count: 3 + Math.floor(rand() * 2),
        length: 9 + rand() * 5,
        jitter: [rand(), rand(), rand(), rand()],
      });
    }
  }
  const parts = [];
  for (const cluster of wrapped(clusters, tile, 10)) {
    const dx = Math.cos(cluster.angle);
    const dy = Math.sin(cluster.angle);
    for (let i = 0; i < cluster.count; i += 1) {
      const offset = (i - (cluster.count - 1) / 2) * 2.7;
      const half = (cluster.length * (0.78 + cluster.jitter[i] * 0.22)) / 2;
      const mx = cluster.x - dy * offset;
      const my = cluster.y + dx * offset;
      parts.push(`M${n(mx - dx * half)} ${n(my - dy * half)}L${n(mx + dx * half)} ${n(my + dy * half)}`);
    }
  }
  return parts.join('');
}

export const HATCH_TILE = 132;
export const HATCH_PATH = buildHatchPath(HATCH_TILE, 7);

function scatter(seed, count, tile, build) {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => build(rand, rand() * tile, rand() * tile));
}

function flagstonePath(tile, seed) {
  const rand = seededRandom(seed);
  const rows = 4;
  const rowHeight = tile / rows;
  const parts = [];
  for (let row = 0; row < rows; row += 1) {
    const y = row * rowHeight;
    parts.push(`M0 ${n(y)}L${tile} ${n(y)}`);
    let x = (row % 2) * 9 + rand() * 4;
    while (x < tile - 6) {
      const top = n(x + (rand() - 0.5) * 2.5);
      const bottom = n(x + (rand() - 0.5) * 2.5);
      parts.push(`M${top} ${n(y)}L${bottom} ${n(y + rowHeight)}`);
      x += 15 + rand() * 13;
    }
  }
  return parts.join('');
}

function planksPath(width, height, seed) {
  const rand = seededRandom(seed);
  const plank = VENUE_CELL / 4;
  const parts = [];
  for (let y = 0; y < height; y += plank) {
    parts.push(`M0 ${y}L${width} ${y}`);
    let x = rand() * 30;
    while (x < width) {
      parts.push(`M${n(x)} ${y}L${n(x)} ${y + plank}`);
      x += 30 + rand() * 25;
    }
  }
  return parts.join('');
}

function grainPath(width, height, seed) {
  const rand = seededRandom(seed);
  const plank = VENUE_CELL / 4;
  const parts = [];
  for (let y = 0; y < height; y += plank) {
    const x = rand() * (width - 16);
    const gy = n(y + 3 + rand() * 4);
    parts.push(`M${n(x)} ${gy}L${n(x + 8 + rand() * 10)} ${gy}`);
  }
  return parts.join('');
}

const dots = (seed, count, tile, minR, maxR) => wrapped(
  scatter(seed, count, tile, (rand, x, y) => ({ x, y, r: minR + rand() * (maxR - minR) })),
  tile,
  maxR,
);

const tufts = wrapped(scatter(31, 16, 80, (rand, x, y) => ({ x, y, s: 0.8 + rand() * 0.5 })), 80, 6);
const waves = wrapped(scatter(41, 9, 80, (rand, x, y) => ({ x, y, s: 0.8 + rand() * 0.5 })), 80, 12);
const rocks = wrapped(
  scatter(51, 16, 80, (rand, x, y) => {
    const radius = 1.6 + rand() * 2.4;
    const sides = 5 + Math.floor(rand() * 2);
    const points = Array.from({ length: sides }, (_, i) => {
      const angle = (i / sides) * Math.PI * 2;
      const r = radius * (0.7 + rand() * 0.45);
      return [Math.cos(angle) * r, Math.sin(angle) * r];
    });
    return { x, y, points };
  }),
  80,
  5,
);

const FLAGSTONE_PATH = flagstonePath(80, 11);
const PLANKS_PATH = planksPath(80, 40, 21);
const GRAIN_PATH = grainPath(80, 40, 22);
const CAVE_DOTS = dots(13, 46, 80, 0.5, 1.2);
const DIRT_DOTS = dots(17, 34, 80, 0.5, 1.4);

// surface decides derived walls (see venueGeometry.isDerivedWall):
//   indoor  — walled against empty space, the map border, and outdoor ground
//   neutral — sits inside rooms or outdoors (water, rubble, chasms); walled only against empty space
//   outdoor — open ground; never walled
// mat is how the Mat Guide draws it with one of the four MAT_COLORS markers:
//   fill none | dots | hatch | solid | planks, plus a short hint for the legend.
export const VENUE_TERRAINS = [
  {
    id: 'floor',
    label: 'Floor',
    surface: 'indoor',
    fill: VENUE_PAPER,
    mat: { color: 'black', fill: 'none', hint: 'Leave blank' },
  },
  {
    id: 'flagstone',
    label: 'Flagstones',
    surface: 'indoor',
    fill: '#efe7d6',
    tile: [80, 80],
    pattern: () => <path d={FLAGSTONE_PATH} stroke="#a2917a" strokeWidth="0.9" fill="none" />,
    mat: { color: 'black', fill: 'none', hint: 'Leave blank' },
  },
  {
    id: 'wood',
    label: 'Wood floor',
    surface: 'indoor',
    fill: '#e6cc9c',
    tile: [80, 40],
    pattern: () => (
      <>
        <path d={GRAIN_PATH} stroke="#c7a676" strokeWidth="0.6" fill="none" />
        <path d={PLANKS_PATH} stroke="#9a7550" strokeWidth="0.8" fill="none" />
      </>
    ),
    mat: { color: 'black', fill: 'none', hint: 'Leave blank' },
  },
  {
    id: 'cave',
    label: 'Cave floor',
    surface: 'indoor',
    fill: '#eee3c9',
    tile: [80, 80],
    pattern: () => CAVE_DOTS.map((dot, i) => (
      <circle key={i} cx={n(dot.x)} cy={n(dot.y)} r={n(dot.r)} fill="#9d8b69" />
    )),
    mat: { color: 'black', fill: 'none', hint: 'Leave blank' },
  },
  {
    id: 'rubble',
    label: 'Rubble',
    surface: 'neutral',
    fill: '#dccfb1',
    tile: [80, 80],
    pattern: () => rocks.map((rock, i) => (
      <polygon
        key={i}
        points={rock.points.map(([px, py]) => `${n(rock.x + px)},${n(rock.y + py)}`).join(' ')}
        fill="#cfc0a2"
        stroke="#6e604c"
        strokeWidth="0.7"
      />
    )),
    mat: { color: 'black', fill: 'dots', hint: 'Dots' },
  },
  {
    id: 'water',
    label: 'Water',
    surface: 'neutral',
    fill: '#b8d2da',
    outline: '#4f7f90',
    tile: [80, 80],
    pattern: () => waves.map((wave, i) => (
      <path
        key={i}
        d={`M${n(wave.x)} ${n(wave.y)}q${n(2.6 * wave.s)} ${n(-2.4 * wave.s)} ${n(5.2 * wave.s)} 0t${n(5.2 * wave.s)} 0`}
        stroke="#5d8c9c"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
      />
    )),
    mat: { color: 'blue', fill: 'hatch', hint: 'Blue lines' },
  },
  {
    id: 'chasm',
    label: 'Chasm / pit',
    surface: 'neutral',
    fill: '#3a3029',
    outline: VENUE_INK,
    tile: [16, 16],
    pattern: () => <path d="M0 16L16 0M-4 4L4 -4M12 20L20 12" stroke="#55493d" strokeWidth="1.2" />,
    mat: { color: 'black', fill: 'solid', hint: 'Shade solid' },
  },
  {
    // Neutral, so a bridge over water or a dock on a shore gets no walls of its own.
    id: 'bridge',
    label: 'Bridge',
    surface: 'neutral',
    fill: '#cfa873',
    outline: '#5e4329',
    tile: [40, 40],
    pattern: () => (
      <>
        <path d="M0 0V40M10 0V40M20 0V40M30 0V40" stroke="#8a6640" strokeWidth="1" fill="none" />
        <path d="M3.5 7v9M14 22v11M23.5 4v8M34 18v12" stroke="#b48a5a" strokeWidth="0.6" strokeLinecap="round" fill="none" />
      </>
    ),
    mat: { color: 'black', fill: 'planks', hint: 'Outline it, plank lines across' },
  },
  {
    id: 'grass',
    label: 'Grass',
    surface: 'outdoor',
    fill: '#d3dfaa',
    tile: [80, 80],
    pattern: () => tufts.map((tuft, i) => {
      const s = tuft.s;
      const x = n(tuft.x);
      const y = n(tuft.y);
      return (
        <path
          key={i}
          d={`M${x} ${y}l${n(-2.4 * s)} ${n(-4 * s)}M${x} ${y}l0 ${n(-5 * s)}M${x} ${y}l${n(2.4 * s)} ${n(-4 * s)}`}
          stroke="#6a8a43"
          strokeWidth="0.9"
          strokeLinecap="round"
          fill="none"
        />
      );
    }),
    mat: { color: 'green', fill: 'dots', hint: 'Green dots' },
  },
  {
    id: 'dirt',
    label: 'Dirt / road',
    surface: 'outdoor',
    fill: '#e2cc9f',
    tile: [80, 80],
    pattern: () => DIRT_DOTS.map((dot, i) => (
      <circle key={i} cx={n(dot.x)} cy={n(dot.y)} r={n(dot.r)} fill="#9a7d4f" />
    )),
    mat: { color: 'black', fill: 'none', hint: 'Leave blank' },
  },
];

// Grid-line kinds. Walls between floor and empty space are derived, so the GM only ever
// places doors, interior walls, and openings (an opening removes a derived wall).
export const VENUE_EDGE_KINDS = [
  { id: 'wall', label: 'Wall', mat: { color: 'black', hint: 'Heavy line' } },
  { id: 'door', label: 'Door', mat: { color: 'black', hint: 'Box across the line' } },
  { id: 'secret_door', label: 'Secret door', gmOnly: true, mat: { color: 'red', hint: 'GM only — draw as wall' } },
  { id: 'opening', label: 'Opening', mat: { color: 'black', hint: 'Leave open' } },
];

const S = { stroke: VENUE_INK, strokeWidth: 1.6, strokeLinejoin: 'round', strokeLinecap: 'round' };

// Canopies spill a little past their square, as trees do on drawn battle maps.
function treeCanopy(radius, lobeRadius, lobes = 9) {
  const points = Array.from({ length: lobes }, (_, i) => {
    const angle = (i / lobes) * Math.PI * 2;
    return [20 + Math.cos(angle) * radius, 20 + Math.sin(angle) * radius];
  });
  const [startX, startY] = points[0];
  const arcs = points.map((_, i) => {
    const [x, y] = points[(i + 1) % lobes];
    return `A${lobeRadius} ${lobeRadius} 0 0 1 ${n(x)} ${n(y)}`;
  });
  return `M${n(startX)} ${n(startY)}${arcs.join('')}Z`;
}
const TREE_CANOPY = treeCanopy(21, 8.6);
const TREE_CROWN = treeCanopy(10.5, 4.8, 6);

const stepsPath = Array.from({ length: 7 }, (_, i) => {
  const y = 7 + i * 4.3;
  const inset = 6 + i * 1.6;
  return `M${n(inset)} ${n(y)}L${n(40 - inset)} ${n(y)}`;
}).join('');

// Stamps are drawn in one 40x40 cell box, centered on (20, 20), facing "up" at rotation 0.
export const VENUE_FEATURES = [
  {
    id: 'stairs',
    label: 'Stairs',
    draw: () => (
      <>
        <path d="M5 5L35 5L28 37L12 37Z" fill={VENUE_PAPER} {...S} />
        <path d={stepsPath} {...S} strokeWidth="1.2" fill="none" />
      </>
    ),
    mat: { color: 'black', glyph: 'St' },
  },
  {
    id: 'pillar',
    label: 'Pillar',
    draw: () => (
      <>
        <circle cx="20" cy="20" r="10.5" fill="#4a3d30" {...S} />
        <path d="M14 16a7.5 7.5 0 0 1 6 -4.6" stroke="#8c7a64" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </>
    ),
    // A drawn mark, not letters: the legend hint says what to draw instead of "Write ●".
    mat: { color: 'black', glyph: '●', hint: 'Fill in a dot' },
  },
  {
    id: 'statue',
    label: 'Statue',
    draw: () => (
      <>
        <circle cx="20" cy="20" r="13" fill="#e2dccd" {...S} />
        <path d="M20 9.5l3 6.6 7.2.7-5.4 4.8 1.6 7.1L20 25l-6.4 3.7 1.6-7.1-5.4-4.8 7.2-.7z" fill="#b9b09c" {...S} strokeWidth="1.2" />
      </>
    ),
    mat: { color: 'black', glyph: 'Sa' },
  },
  {
    id: 'altar',
    label: 'Altar',
    draw: () => (
      <>
        <rect x="7" y="12" width="26" height="16" rx="1.5" fill="#ddd5c4" {...S} />
        <path d="M10 15.5h20" {...S} strokeWidth="1" />
        <circle cx="12.5" cy="22" r="2" fill="#f6e7b8" {...S} strokeWidth="1" />
        <circle cx="27.5" cy="22" r="2" fill="#f6e7b8" {...S} strokeWidth="1" />
      </>
    ),
    mat: { color: 'black', glyph: 'Al' },
  },
  {
    id: 'table',
    label: 'Table',
    draw: () => (
      <>
        <rect x="6" y="10" width="28" height="20" rx="1.5" fill="#d6b07c" {...S} />
        <path d="M10 16.5h13M15 23.5h15" stroke="#a7804f" strokeWidth="0.9" strokeLinecap="round" />
      </>
    ),
    mat: { color: 'black', glyph: 'Tb' },
  },
  {
    id: 'bed',
    label: 'Bed',
    draw: () => (
      <>
        <rect x="10" y="5" width="20" height="30" rx="1.5" fill="#efe6d2" {...S} />
        <rect x="12.5" y="7.5" width="15" height="6" rx="2" fill={VENUE_PAPER} {...S} strokeWidth="1.1" />
        <path d="M10 17h20v16.5a1.5 1.5 0 0 1 -1.5 1.5h-17a1.5 1.5 0 0 1 -1.5 -1.5z" fill="#9c7a6a" {...S} strokeWidth="1.2" />
      </>
    ),
    mat: { color: 'black', glyph: 'Bd' },
  },
  {
    id: 'chest',
    label: 'Chest',
    draw: () => (
      <>
        <rect x="9" y="12" width="22" height="16" rx="1.5" fill="#c8955a" {...S} />
        <path d="M9 18h22" {...S} strokeWidth="1.2" />
        <rect x="18" y="16.5" width="4" height="4.5" fill="#e8cc7a" {...S} strokeWidth="1" />
      </>
    ),
    mat: { color: 'black', glyph: 'Ch' },
  },
  {
    id: 'barrel',
    label: 'Barrel',
    draw: () => (
      <>
        <circle cx="20" cy="20" r="11" fill="#c9995c" {...S} />
        <circle cx="20" cy="20" r="7" fill="none" stroke="#7d5a33" strokeWidth="1.1" />
        <circle cx="20" cy="20" r="2" fill="#7d5a33" />
      </>
    ),
    mat: { color: 'black', glyph: 'Ba' },
  },
  {
    id: 'crate',
    label: 'Crate',
    draw: () => (
      <>
        <rect x="9" y="9" width="22" height="22" rx="1" fill="#d6ad72" {...S} />
        <rect x="12" y="12" width="16" height="16" fill="none" stroke="#8d6638" strokeWidth="1" />
        <path d="M12 12L28 28M28 12L12 28" stroke="#8d6638" strokeWidth="1.1" strokeLinecap="round" />
      </>
    ),
    mat: { color: 'black', glyph: 'Cr' },
  },
  {
    id: 'well',
    label: 'Well',
    draw: () => (
      <>
        <circle cx="20" cy="20" r="13" fill="#cfc6b4" {...S} />
        <circle cx="20" cy="20" r="8.5" fill="#6f9cab" {...S} strokeWidth="1.3" />
      </>
    ),
    mat: { color: 'blue', glyph: 'W' },
  },
  {
    id: 'campfire',
    label: 'Campfire',
    draw: () => (
      <>
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          return <circle key={i} cx={n(20 + Math.cos(angle) * 11)} cy={n(20 + Math.sin(angle) * 11)} r="3" fill="#a59a88" {...S} strokeWidth="1" />;
        })}
        <path d="M20 10c4 5 7 8 7 12a7 7 0 0 1 -14 0c0 -4 3 -7 7 -12z" fill="#e0782c" {...S} strokeWidth="1.2" />
        <path d="M20 17c2 2.6 3.4 4.2 3.4 6a3.4 3.4 0 0 1 -6.8 0c0 -1.8 1.4 -3.4 3.4 -6z" fill="#f6c95a" />
      </>
    ),
    mat: { color: 'red', glyph: 'F' },
  },
  {
    id: 'tree',
    label: 'Tree',
    draw: () => (
      <>
        <path d={TREE_CANOPY} transform="translate(2.5 3)" fill={VENUE_INK} opacity="0.2" />
        <path d={TREE_CANOPY} fill="#7fa25a" stroke="#3f5a2a" strokeWidth="1.6" strokeLinejoin="round" />
        <path d={TREE_CROWN} transform="translate(-2.5 -2.5)" fill="#9cbd74" stroke="#5d7d3c" strokeWidth="1" strokeLinejoin="round" />
        <circle cx="20" cy="20" r="2.4" fill="#5b4430" />
      </>
    ),
    mat: { color: 'green', glyph: 'T' },
  },
  {
    id: 'boulder',
    label: 'Boulder',
    draw: () => (
      <>
        <path d="M5 25l4 -13 11.5 -6 11.5 5.5 4 12 -7.5 10 -15 1.5z" transform="translate(1.5 2)" fill={VENUE_INK} opacity="0.18" />
        <path d="M5 25l4 -13 11.5 -6 11.5 5.5 4 12 -7.5 10 -15 1.5z" fill="#bbae97" {...S} />
        <path d="M20 9l2.5 9 -5 6.5M27 21l3.5 2.5" stroke="#7a6d58" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      </>
    ),
    mat: { color: 'black', glyph: 'Bo' },
  },
  {
    id: 'trap',
    label: 'Trap',
    defaultGmOnly: true,
    draw: () => (
      <>
        <rect x="8" y="8" width="24" height="24" fill="none" stroke={VENUE_SECRET_INK} strokeWidth="1.8" strokeDasharray="4 2.5" />
        <path d="M13 13L27 27M27 13L13 27" stroke={VENUE_SECRET_INK} strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
    mat: { color: 'red', glyph: 'X' },
  },
  {
    id: 'label',
    label: 'Label',
    text: true,
    draw: () => (
      <text x="20" y="27" textAnchor="middle" fontSize="20" fontFamily="'Linux Libertine Display O', Georgia, serif" fill={VENUE_INK}>Aa</text>
    ),
    mat: { color: 'black', glyph: 'Aa' },
  },
];

const TERRAIN_BY_ID = Object.fromEntries(VENUE_TERRAINS.map((terrain) => [terrain.id, terrain]));
const FEATURE_BY_ID = Object.fromEntries(VENUE_FEATURES.map((feature) => [feature.id, feature]));
const EDGE_BY_ID = Object.fromEntries(VENUE_EDGE_KINDS.map((edge) => [edge.id, edge]));

// Unknown ids (from a newer catalog) degrade to plain floor / a labelled box rather than vanishing.
const UNKNOWN_TERRAIN = { ...TERRAIN_BY_ID.floor, id: 'unknown', label: 'Unknown terrain' };
const UNKNOWN_FEATURE = {
  id: 'unknown',
  label: 'Unknown piece',
  draw: () => <rect x="10" y="10" width="20" height="20" fill="none" {...S} strokeDasharray="3 2" />,
  mat: { color: 'black', glyph: '?' },
};

export const getTerrain = (id) => TERRAIN_BY_ID[id] || UNKNOWN_TERRAIN;
export const getFeature = (id) => FEATURE_BY_ID[id] || UNKNOWN_FEATURE;
export const getEdgeKind = (id) => EDGE_BY_ID[id] || EDGE_BY_ID.wall;
export const isKnownTerrain = (id) => Boolean(TERRAIN_BY_ID[id]);
export const isKnownFeature = (id) => Boolean(FEATURE_BY_ID[id]);
