import React from 'react';
import { getMarkerSymbol, markerBase } from '../markerSymbols';
import '../styles/MarkerSymbol.css';

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
      <g
        fill="none"
        stroke={ink}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(12 12) scale(0.74) translate(-12 -12)"
      >
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
    </svg>
  );
}

export default MarkerSymbol;
