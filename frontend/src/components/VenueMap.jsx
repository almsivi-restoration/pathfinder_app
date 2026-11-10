import React, { useId, useMemo } from 'react';
import {
  HATCH_PATH,
  HATCH_TILE,
  VENUE_CELL as C,
  VENUE_HATCH_INK,
  VENUE_INK,
  VENUE_PAPER,
  VENUE_SECRET_INK,
  VENUE_VOID,
  getFeature,
  getTerrain,
} from '../venueCatalog';
import { cellsPath, resolveEdges, segmentsPath, terrainOutline } from '../venueGeometry';
import '../styles/VenueMap.css';

// Half a cell of margin around the map holds the frame.
export const VENUE_PAD = C / 2;
const WALL_WIDTH = 6.4;
const HATCH_BAND = C * 1.2;
const GRID_INK = 'rgba(43, 33, 22, 0.17)';
const LABEL_FONT = "'Linux Libertine Display O', 'Linux Libertine O', Georgia, serif";

const safeId = (raw) => raw.replace(/[^a-zA-Z0-9]/g, '');

// Map a pointer position to fractional cell coordinates. Uses the bounding box rather than
// getScreenCTM so it also works in jsdom (tests mock getBoundingClientRect).
export function pointerToCell(svg, venue, clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const viewWidth = venue.width * C + VENUE_PAD * 2;
  const viewHeight = venue.height * C + VENUE_PAD * 2;
  const ux = ((clientX - rect.left) / rect.width) * viewWidth - VENUE_PAD;
  const uy = ((clientY - rect.top) / rect.height) * viewHeight - VENUE_PAD;
  return { x: ux / C, y: uy / C };
}

function TerrainPattern({ id, terrain }) {
  const [tileWidth, tileHeight] = terrain.tile;
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={tileWidth} height={tileHeight}>
      <rect width={tileWidth} height={tileHeight} fill={terrain.fill} />
      {terrain.pattern()}
    </pattern>
  );
}

const terrainPaint = (terrain, patternId) => (terrain.pattern ? `url(#${patternId})` : terrain.fill);

function Door({ x, y, side }) {
  const transform = `translate(${x * C} ${y * C})${side === 'w' ? ' rotate(90)' : ''}`;
  return (
    <g transform={transform} className="venue-map-door">
      <path d={`M0 0L${C * 0.22} 0M${C * 0.78} 0L${C} 0`} stroke={VENUE_INK} strokeWidth={WALL_WIDTH} strokeLinecap="square" />
      <rect x={C * 0.22} y={-C * 0.14} width={C * 0.56} height={C * 0.28} fill={VENUE_PAPER} stroke={VENUE_INK} strokeWidth="1.8" />
    </g>
  );
}

function SecretMark({ x, y, side }) {
  const cx = side === 'n' ? (x + 0.5) * C : x * C;
  const cy = side === 'n' ? y * C : (y + 0.5) * C;
  return (
    <text
      x={cx}
      y={cy}
      className="venue-map-secret"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="20"
      fontWeight="bold"
      fontFamily={LABEL_FONT}
      fill={VENUE_SECRET_INK}
      stroke={VENUE_PAPER}
      strokeWidth="4.5"
      paintOrder="stroke"
    >
      S
    </text>
  );
}

function Feature({ feature, mode, selected }) {
  const definition = getFeature(feature.kind);
  const isLabel = Boolean(definition.text);
  const caption = feature.label?.trim();
  if (isLabel && !caption && mode === 'player') return null;
  const rotation = feature.rotation ? `rotate(${feature.rotation} ${C / 2} ${C / 2})` : undefined;
  return (
    <g
      transform={`translate(${feature.x * C} ${feature.y * C})`}
      className={`venue-map-feature${feature.gm_only ? ' gm-only' : ''}`}
      data-feature-id={feature.id}
      data-kind={feature.kind}
    >
      <title>{caption || definition.label}</title>
      {feature.gm_only && (
        <rect x="1.5" y="1.5" width={C - 3} height={C - 3} fill="none" stroke={VENUE_SECRET_INK} strokeWidth="1.3" strokeDasharray="4 3" />
      )}
      <g transform={rotation}>
        {isLabel && caption ? (
          <text
            x={C / 2}
            y={C / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="24"
            fontFamily={LABEL_FONT}
            fill={VENUE_INK}
            stroke={VENUE_PAPER}
            strokeWidth="5"
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {caption}
          </text>
        ) : definition.draw()}
      </g>
      {selected && (
        <>
          <rect className="venue-map-casing" x="-2" y="-2" width={C + 4} height={C + 4} rx="4" fill="none" stroke={VENUE_INK} />
          <rect className="venue-map-selection" x="-2" y="-2" width={C + 4} height={C + 4} rx="4" fill="none" />
        </>
      )}
    </g>
  );
}

// The one venue renderer, shared by the editor, the Venue Screen, and previews.
// mode="player" draws what the table may see: secret doors become walls, GM-only stamps vanish.
// Without pxPerCell the map scales to fill its container.
export default function VenueMap({
  venue,
  mode = 'gm',
  pxPerCell,
  editorGrid = false,
  selectedFeatureId = null,
  svgRef,
  className = '',
  children,
  ...handlers
}) {
  const ids = safeId(useId());
  const width = venue.width * C;
  const height = venue.height * C;

  const layers = useMemo(() => {
    const byTerrain = new Map();
    const hatched = [];
    Object.entries(venue.cells).forEach(([key, terrainId]) => {
      if (!byTerrain.has(terrainId)) byTerrain.set(terrainId, []);
      byTerrain.get(terrainId).push(key);
      if (getTerrain(terrainId).surface !== 'outdoor') hatched.push(key);
    });
    const terrains = [...byTerrain.entries()].map(([terrainId, keys], index) => {
      const terrain = getTerrain(terrainId);
      return {
        terrainId,
        terrain,
        patternId: `vt${ids}${index}`,
        path: cellsPath(keys, C),
        outline: terrain.outline ? segmentsPath(terrainOutline(venue, terrainId), C) : null,
      };
    });
    return {
      terrains,
      hatchPath: cellsPath(hatched, C),
      allCellsPath: cellsPath(Object.keys(venue.cells), C),
      edges: resolveEdges(venue, mode),
    };
  }, [venue, mode, ids]);

  const features = mode === 'player' ? venue.features.filter((feature) => !feature.gm_only) : venue.features;
  const viewBox = `${-VENUE_PAD} ${-VENUE_PAD} ${width + VENUE_PAD * 2} ${height + VENUE_PAD * 2}`;
  const sizing = pxPerCell
    ? { width: (venue.width + 1) * pxPerCell, height: (venue.height + 1) * pxPerCell }
    : { width: '100%', height: '100%' };

  return (
    <svg
      ref={svgRef}
      className={`venue-map venue-map-${mode} ${className}`.trim()}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={venue.name || 'Venue map'}
      {...sizing}
      {...handlers}
    >
      <defs>
        <pattern id={`vh${ids}`} patternUnits="userSpaceOnUse" width={HATCH_TILE} height={HATCH_TILE}>
          <path d={HATCH_PATH} stroke={VENUE_HATCH_INK} strokeWidth="0.85" strokeLinecap="round" fill="none" />
        </pattern>
        <pattern id={`vg${ids}`} patternUnits="userSpaceOnUse" width={C} height={C}>
          <path d={`M${C} 0L0 0L0 ${C}`} fill="none" stroke={GRID_INK} strokeWidth="1" />
        </pattern>
        <clipPath id={`vc${ids}`}>
          <rect x="0" y="0" width={width} height={height} />
        </clipPath>
        {layers.terrains.filter(({ terrain }) => terrain.pattern).map(({ terrain, patternId }) => (
          <TerrainPattern key={patternId} id={patternId} terrain={terrain} />
        ))}
      </defs>

      <rect x={-VENUE_PAD} y={-VENUE_PAD} width={width + VENUE_PAD * 2} height={height + VENUE_PAD * 2} fill={VENUE_VOID} />
      {editorGrid && <rect x="0" y="0" width={width} height={height} fill={`url(#vg${ids})`} className="venue-map-void-grid" />}

      <g clipPath={`url(#vc${ids})`}>
        {layers.hatchPath && (
          <path
            d={layers.hatchPath}
            fill={`url(#vh${ids})`}
            stroke={`url(#vh${ids})`}
            strokeWidth={HATCH_BAND}
            strokeLinejoin="round"
            className="venue-map-hatch"
          />
        )}
        {layers.terrains.map(({ terrainId, terrain, patternId, path }) => (
          <path key={terrainId} d={path} fill={terrainPaint(terrain, patternId)} data-terrain={terrainId} />
        ))}
        {layers.terrains.filter(({ outline }) => outline).map(({ terrainId, terrain, outline }) => (
          <path key={`${terrainId}-outline`} d={outline} stroke={terrain.outline} strokeWidth="2" strokeLinecap="round" fill="none" />
        ))}
        {layers.allCellsPath && <path d={layers.allCellsPath} fill={`url(#vg${ids})`} />}
      </g>

      <path
        d={segmentsPath(layers.edges.walls, C)}
        stroke={VENUE_INK}
        strokeWidth={WALL_WIDTH}
        strokeLinecap="square"
        fill="none"
        className="venue-map-walls"
      />
      {layers.edges.doors.map((door) => <Door key={`${door.x},${door.y},${door.side}`} {...door} />)}
      {layers.edges.secretDoors.map((door) => <SecretMark key={`${door.x},${door.y},${door.side}`} {...door} />)}

      {features.map((feature) => (
        <Feature key={feature.id} feature={feature} mode={mode} selected={feature.id === selectedFeatureId} />
      ))}

      <rect x="-6" y="-6" width={width + 12} height={height + 12} fill="none" stroke={VENUE_INK} strokeWidth="2.4" />
      <rect x="-12" y="-12" width={width + 24} height={height + 24} fill="none" stroke={VENUE_INK} strokeWidth="0.9" />
      {children}
    </svg>
  );
}

// Palette swatches: one cell of terrain or one stamp, drawn with the real art.
export function TerrainSwatch({ terrainId, size = 28 }) {
  const ids = safeId(useId());
  const terrain = getTerrain(terrainId);
  return (
    <svg className="venue-swatch" width={size} height={size} viewBox={`0 0 ${C} ${C}`} aria-hidden="true">
      {terrain.pattern && (
        <defs>
          <TerrainPattern id={`ts${ids}`} terrain={terrain} />
        </defs>
      )}
      <rect width={C} height={C} fill={terrainPaint(terrain, `ts${ids}`)} />
    </svg>
  );
}

// Padded so stamps that spill past their square (tree canopies) are not clipped.
const SWATCH_PAD = 8;

export function FeatureSwatch({ kind, size = 28 }) {
  return (
    <svg
      className="venue-swatch"
      width={size}
      height={size}
      viewBox={`${-SWATCH_PAD} ${-SWATCH_PAD} ${C + SWATCH_PAD * 2} ${C + SWATCH_PAD * 2}`}
      aria-hidden="true"
    >
      <rect x={-SWATCH_PAD} y={-SWATCH_PAD} width={C + SWATCH_PAD * 2} height={C + SWATCH_PAD * 2} fill={VENUE_PAPER} />
      {getFeature(kind).draw()}
    </svg>
  );
}
