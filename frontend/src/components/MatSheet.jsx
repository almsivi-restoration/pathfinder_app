import React, { useId, useMemo } from 'react';
import { MAT_COLORS, VENUE_CELL as U, getFeature, getTerrain } from '../venueCatalog';
import { cellsPath, columnLabel, resolveEdges, segmentsPath, terrainOutline } from '../venueGeometry';
import { planksSegments } from '../matGuide';
import '../styles/MatSheet.css';

// The table mat as a whiteboard: every square drawn, every fifth line heavier for counting,
// mat coordinates on all four sides. Venue art is drawn the way it goes on with the four
// markers, not the screen art. Colors are mat content, like the venue catalog's, not theme tokens.
const GUTTER = 40;
const AXIS_SIZE = 22;
const CLOSE_UP_MARGIN = 2;
const BOARD = '#fcfcf9';
const RAIL = '#e6e8eb';
const RAIL_EDGE = '#8a9199';
const GRID = '#d3d7dc';
const GRID_FIVE = '#9ba2aa';
const AXIS_INK = '#5d646c';
const AXIS_INK_FIVE = '#2f343a';
const CONTINUES = '#5f7fa8';
const WALL_WIDTH = 6;
const MARK_FONT = "'DejaVu Sans', Verdana, Arial, sans-serif";

const safeId = (raw) => raw.replace(/[^a-zA-Z0-9]/g, '');
const patternId = (prefix, fill, color) => `${prefix}${fill}${color}`;

// Dots and hatching for every marker color; patterns tile per mat square.
function MatPatterns({ prefix }) {
  return Object.entries(MAT_COLORS).map(([color, ink]) => (
    <React.Fragment key={color}>
      <pattern id={patternId(prefix, 'dots', color)} patternUnits="userSpaceOnUse" width={U} height={U}>
        <circle cx="11" cy="12" r="2.4" fill={ink} />
        <circle cx="28" cy="19" r="2.4" fill={ink} />
        <circle cx="15" cy="30" r="2.4" fill={ink} />
      </pattern>
      <pattern id={patternId(prefix, 'hatch', color)} patternUnits="userSpaceOnUse" width={U} height={U}>
        <path d="M-5 15L15 -5M-5 35L35 -5M5 45L45 5M25 45L45 25" stroke={ink} strokeWidth="1.8" fill="none" />
      </pattern>
    </React.Fragment>
  ));
}

function fillPaint(prefix, mat) {
  if (mat.fill === 'dots' || mat.fill === 'hatch') return `url(#${patternId(prefix, mat.fill, mat.color)})`;
  if (mat.fill === 'solid') return MAT_COLORS[mat.color];
  return null;
}

function MatDoor({ x, y, side }) {
  const transform = `translate(${x * U} ${y * U})${side === 'w' ? ' rotate(90)' : ''}`;
  return (
    <g transform={transform} className="mat-door">
      <path d={`M0 0L${U * 0.22} 0M${U * 0.78} 0L${U} 0`} stroke={MAT_COLORS.black} strokeWidth={WALL_WIDTH} strokeLinecap="square" />
      <rect x={U * 0.22} y={-U * 0.15} width={U * 0.56} height={U * 0.3} fill={BOARD} stroke={MAT_COLORS.black} strokeWidth="2.2" />
    </g>
  );
}

function MatSecretMark({ x, y, side }) {
  const cx = side === 'n' ? (x + 0.5) * U : x * U;
  const cy = side === 'n' ? y * U : (y + 0.5) * U;
  return (
    <text
      x={cx}
      y={cy}
      className="mat-secret"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="18"
      fontWeight="bold"
      fontFamily={MARK_FONT}
      fill={MAT_COLORS.red}
      stroke={BOARD}
      strokeWidth="4"
      paintOrder="stroke"
    >
      S
    </text>
  );
}

function MatGlyph({ text, color, size = 19, x = U / 2, y = U / 2 }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={size}
      fontWeight="bold"
      fontFamily={MARK_FONT}
      fill={MAT_COLORS[color] || MAT_COLORS.black}
      stroke={BOARD}
      strokeWidth="4"
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {text}
    </text>
  );
}

function GmRing() {
  return <circle cx={U / 2} cy={U / 2} r={U * 0.43} fill="none" stroke={MAT_COLORS.red} strokeWidth="1.8" strokeDasharray="4 3" />;
}

function MatFeature({ feature }) {
  const definition = getFeature(feature.kind);
  const caption = feature.label?.trim();
  if (definition.text && !caption) return null;
  return (
    <g
      transform={`translate(${feature.x * U} ${feature.y * U})`}
      className={`mat-feature${feature.gm_only ? ' gm-only' : ''}`}
      data-kind={feature.kind}
    >
      <title>{caption || definition.label}</title>
      {feature.gm_only && <GmRing />}
      <g opacity={feature.gm_only ? 0.6 : 1}>
        {definition.text
          ? <MatGlyph text={caption} color={definition.mat.color} size={15} />
          : <MatGlyph text={definition.mat.glyph} color={definition.mat.color} />}
      </g>
    </g>
  );
}

// The part of the mat to show, in squares: all of it, or the map plus a small margin.
export function matView(plan, section, view = 'mat') {
  if (view !== 'closeup') return { x0: 0, y0: 0, x1: plan.columns, y1: plan.rows };
  return {
    x0: Math.max(0, section.left - CLOSE_UP_MARGIN),
    y0: Math.max(0, section.top - CLOSE_UP_MARGIN),
    x1: Math.min(plan.columns, section.left + section.width + CLOSE_UP_MARGIN),
    y1: Math.min(plan.rows, section.top + section.height + CLOSE_UP_MARGIN),
  };
}

// One venue section on the mat. `plan` and `section` come from planMat; `view` is 'mat' or 'closeup'.
// The coordinates sit on a ruler band around the view so they read on any background.
export default function MatSheet({ venue, plan, section, view = 'mat' }) {
  const ids = safeId(useId());
  const { columns, rows } = plan;
  const boardWidth = columns * U;
  const boardHeight = rows * U;

  const layers = useMemo(() => {
    const byTerrain = new Map();
    Object.entries(venue.cells).forEach(([key, terrainId]) => {
      if (!byTerrain.has(terrainId)) byTerrain.set(terrainId, []);
      byTerrain.get(terrainId).push(key);
    });
    const terrains = [...byTerrain.entries()]
      .map(([terrainId, keys]) => ({ terrainId, mat: getTerrain(terrainId).mat, keys }))
      .filter(({ mat }) => mat.fill !== 'none')
      .map(({ terrainId, mat, keys }) => ({
        terrainId,
        mat,
        path: cellsPath(keys, U),
        outline: segmentsPath(terrainOutline(venue, terrainId), U),
        planks: mat.fill === 'planks' ? segmentsPath(planksSegments(venue, terrainId), U) : null,
      }));
    return { terrains, edges: resolveEdges(venue, 'gm') };
  }, [venue]);

  const gridLines = useMemo(() => {
    const thin = [];
    const five = [];
    for (let x = 1; x < columns; x += 1) (x % 5 === 0 ? five : thin).push(`M${x * U} 0V${boardHeight}`);
    for (let y = 1; y < rows; y += 1) (y % 5 === 0 ? five : thin).push(`M0 ${y * U}H${boardWidth}`);
    return { thin: thin.join(''), five: five.join('') };
  }, [columns, rows, boardWidth, boardHeight]);

  const offsetX = (section.left - section.x0) * U;
  const offsetY = (section.top - section.y0) * U;
  const clip = { x: section.x0 * U - WALL_WIDTH, y: section.y0 * U - WALL_WIDTH, width: section.width * U + WALL_WIDTH * 2, height: section.height * U + WALL_WIDTH * 2 };
  const footprint = { x: section.left * U, y: section.top * U, width: section.width * U, height: section.height * U };
  const features = venue.features.filter(({ x, y }) => x >= section.x0 && x < section.x1 && y >= section.y0 && y < section.y1);
  const tick = U * 0.6;
  const closeUp = view === 'closeup';
  const shown = matView(plan, section, view);
  const crop = {
    x: shown.x0 * U,
    y: shown.y0 * U,
    width: (shown.x1 - shown.x0) * U,
    height: (shown.y1 - shown.y0) * U,
  };
  const band = { x: crop.x - GUTTER, y: crop.y - GUTTER, width: crop.width + GUTTER * 2, height: crop.height + GUTTER * 2 };

  const axis = (label, key, x, y, isFive) => (
    <text
      key={key}
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={AXIS_SIZE}
      fontWeight={isFive ? 'bold' : 'normal'}
      fontFamily={MARK_FONT}
      fill={isFive ? AXIS_INK_FIVE : AXIS_INK}
    >
      {label}
    </text>
  );

  return (
    <svg
      className="mat-sheet"
      viewBox={`${band.x} ${band.y} ${band.width} ${band.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${venue.name || 'Venue'} on a ${columns} by ${rows} square mat${closeUp ? ', close-up' : ''}`}
      data-orientation={plan.orientation}
      data-view={closeUp ? 'closeup' : 'mat'}
    >
      <defs>
        <MatPatterns prefix={`mp${ids}`} />
        <clipPath id={`mc${ids}`}>
          <rect {...clip} />
        </clipPath>
        <clipPath id={`mv${ids}`}>
          <rect {...crop} />
        </clipPath>
      </defs>

      <rect {...band} rx="6" fill={RAIL} stroke={RAIL_EDGE} strokeWidth="2" />
      <g clipPath={`url(#mv${ids})`}>
        <rect x="0" y="0" width={boardWidth} height={boardHeight} fill={BOARD} />
        <path d={gridLines.thin} stroke={GRID} strokeWidth="1" fill="none" />
        <path d={gridLines.five} stroke={GRID_FIVE} strokeWidth="1.8" fill="none" />

        <path
          className="mat-footprint"
          d={[
            `M${footprint.x} ${footprint.y + tick}V${footprint.y}H${footprint.x + tick}`,
            `M${footprint.x + footprint.width - tick} ${footprint.y}H${footprint.x + footprint.width}V${footprint.y + tick}`,
            `M${footprint.x + footprint.width} ${footprint.y + footprint.height - tick}V${footprint.y + footprint.height}H${footprint.x + footprint.width - tick}`,
            `M${footprint.x + tick} ${footprint.y + footprint.height}H${footprint.x}V${footprint.y + footprint.height - tick}`,
          ].join('')}
          stroke={GRID_FIVE}
          strokeWidth="2.5"
          fill="none"
        />

        <g transform={`translate(${offsetX} ${offsetY})`}>
          <g clipPath={`url(#mc${ids})`}>
            {layers.terrains.map(({ terrainId, mat, path, outline, planks }) => (
              <g key={terrainId} className="mat-terrain" data-terrain={terrainId}>
                {fillPaint(`mp${ids}`, mat) && (
                  <path d={path} fill={fillPaint(`mp${ids}`, mat)} opacity={mat.fill === 'solid' ? 0.55 : 1} />
                )}
                {planks && <path d={planks} stroke={MAT_COLORS[mat.color]} strokeWidth="1.6" fill="none" />}
                <path d={outline} stroke={MAT_COLORS[mat.color]} strokeWidth="2.2" strokeLinecap="round" fill="none" />
              </g>
            ))}
            <path
              className="mat-walls"
              d={segmentsPath(layers.edges.walls, U)}
              stroke={MAT_COLORS.black}
              strokeWidth={WALL_WIDTH}
              strokeLinecap="square"
              fill="none"
            />
            {layers.edges.doors.map((door) => <MatDoor key={`${door.x},${door.y},${door.side}`} {...door} />)}
            {layers.edges.secretDoors.map((door) => <MatSecretMark key={`${door.x},${door.y},${door.side}`} {...door} />)}
          </g>
          {features.map((feature) => <MatFeature key={feature.id} feature={feature} />)}
        </g>

        <g className="mat-continues" stroke={CONTINUES} strokeWidth="3" strokeDasharray="10 7" fill="none">
          {section.continues.left && <path d={`M${footprint.x} ${footprint.y}V${footprint.y + footprint.height}`} />}
          {section.continues.right && <path d={`M${footprint.x + footprint.width} ${footprint.y}V${footprint.y + footprint.height}`} />}
          {section.continues.up && <path d={`M${footprint.x} ${footprint.y}H${footprint.x + footprint.width}`} />}
          {section.continues.down && <path d={`M${footprint.x} ${footprint.y + footprint.height}H${footprint.x + footprint.width}`} />}
        </g>

        {/* The real mat edge; in a close-up it only shows where the view reaches it. */}
        <rect className="mat-edge" x="0" y="0" width={boardWidth} height={boardHeight} fill="none" stroke={RAIL_EDGE} strokeWidth="5" />
      </g>

      <g className="mat-axis" aria-hidden="true">
        {Array.from({ length: shown.x1 - shown.x0 }, (_, index) => {
          const x = shown.x0 + index;
          const isFive = (x + 1) % 5 === 0;
          return [
            axis(columnLabel(x), `t${x}`, (x + 0.5) * U, crop.y - GUTTER / 2, isFive),
            axis(columnLabel(x), `b${x}`, (x + 0.5) * U, crop.y + crop.height + GUTTER / 2, isFive),
          ];
        })}
        {Array.from({ length: shown.y1 - shown.y0 }, (_, index) => {
          const y = shown.y0 + index;
          const isFive = (y + 1) % 5 === 0;
          return [
            axis(String(y + 1), `l${y}`, crop.x - GUTTER / 2, (y + 0.5) * U, isFive),
            axis(String(y + 1), `r${y}`, crop.x + crop.width + GUTTER / 2, (y + 0.5) * U, isFive),
          ];
        })}
      </g>
    </svg>
  );
}

// One mat square showing a legend entry from matLegend, drawn exactly as on the sheet.
export function MatSwatch({ entry, size = 30 }) {
  const ids = safeId(useId());
  const prefix = `ms${ids}`;
  let body = null;
  if (entry.type === 'terrain') {
    const paint = fillPaint(prefix, entry);
    body = (
      <>
        {paint && <rect x="3" y="3" width={U - 6} height={U - 6} fill={paint} opacity={entry.fill === 'solid' ? 0.55 : 1} />}
        {entry.fill === 'planks' && (
          <path d={`M${U / 3} 3V${U - 3}M${(U * 2) / 3} 3V${U - 3}`} stroke={MAT_COLORS[entry.color]} strokeWidth="1.6" />
        )}
        <rect x="3" y="3" width={U - 6} height={U - 6} fill="none" stroke={MAT_COLORS[entry.color]} strokeWidth="2.2" />
      </>
    );
  } else if (entry.type === 'edge') {
    const line = <path d={`M0 ${U / 2}H${U}`} stroke={MAT_COLORS.black} strokeWidth={WALL_WIDTH} />;
    if (entry.id === 'door') body = <MatDoor x={0} y={0.5} side="n" />;
    else if (entry.id === 'secret_door') body = <>{line}<MatSecretMark x={0} y={0.5} side="n" /></>;
    else body = line;
  } else if (entry.type === 'feature') {
    body = <MatGlyph text={entry.glyph} color={entry.color} size={entry.glyph.length > 1 ? 16 : 19} />;
  } else if (entry.type === 'gm-only') {
    body = <><GmRing /><g opacity="0.6"><MatGlyph text="X" color="red" /></g></>;
  }
  return (
    <svg className="mat-swatch" width={size} height={size} viewBox={`0 0 ${U} ${U}`} aria-hidden="true">
      <defs>
        <MatPatterns prefix={prefix} />
      </defs>
      <rect x="1" y="1" width={U - 2} height={U - 2} fill={BOARD} stroke={GRID_FIVE} strokeWidth="2" />
      {body}
    </svg>
  );
}
