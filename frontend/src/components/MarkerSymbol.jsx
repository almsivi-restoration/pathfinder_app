import React from 'react';
import { getMarkerSymbol, markerBase } from '../markerSymbols';
import '../styles/MarkerSymbol.css';

// The symbol's strokes in a 24x24 box, inked in `ink`. Shared by the badge below, actor
// stamps on a venue, and the Mat Guide (which inks them in a mat marker color, no base).
const BADGE_INSET = 'translate(12 12) scale(0.74) translate(-12 -12)';

export function MarkerShapes({ definition, ink, strokeWidth = 2.6, transform }) {
  return (
    <g fill="none" stroke={ink} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" transform={transform}>
      {definition.shapes.map((shape, index) => (
        shape.type === 'circle' ? (
          <circle
            key={index}
            cx={shape.cx}
            cy={shape.cy}
            r={shape.r}
            fill={shape.filled ? ink : 'none'}
            stroke={shape.filled ? 'none' : ink}
          />
        ) : (
          <path key={index} d={shape.d} />
        )
      ))}
    </g>
  );
}

// A marker on its base disc in a 24x24 box. Without a known symbol it falls back to the
// first letter of `name`, which is just as easy to ink on a base.
export function MarkerArt({ symbol, color, name = '' }) {
  const definition = getMarkerSymbol(symbol);
  const base = markerBase(color);
  const ink = color || base.ink;
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <g>
      <circle className="marker-base-disc" cx="12" cy="12" r="11.25" fill={base.fill} stroke={base.rim} strokeWidth="1.5" />
      {definition ? (
        <MarkerShapes definition={definition} ink={ink} transform={BADGE_INSET} />
      ) : (
        <text x="12" y="12.5" textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="700" fill={ink}>{initial}</text>
      )}
    </g>
  );
}

// Renders an actor's marker symbol in its marker color on the miniature's base,
// the way it is inked on the table. The base is content (markerSymbols.js), not
// a theme surface, so the mark reads the same under every theme. Unknown or
// empty ids render nothing (a newer catalog's symbol on an older build simply
// doesn't show).
function MarkerSymbol({ symbol, color, size = 20, className = '' }) {
  const definition = getMarkerSymbol(symbol);
  if (!definition) return null;
  const base = markerBase(color);
  const ink = color || base.ink;
  return (
    <svg
      className={`marker-symbol ${className}`.trim()}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={`${definition.label} marker`}
    >
      <title>{`${definition.label} marker`}</title>
      <circle className="marker-base-disc" cx="12" cy="12" r="11.25" fill={base.fill} stroke={base.rim} strokeWidth="1.5" />
      <MarkerShapes definition={definition} ink={ink} transform={BADGE_INSET} />
    </svg>
  );
}

export default MarkerSymbol;
