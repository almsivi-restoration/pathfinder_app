// Marker symbols: shapes a GM can draw on a physical miniature base with one
// dry-erase marker. Geometry is in a 24x24 box; strokes render with round caps
// and joins so on-screen symbols read like marker strokes. Ids are persisted on
// actors (Actor.symbol) — never rename one, only add.
export const MARKER_SYMBOLS = [
  { id: 'dot', label: 'Dot', shapes: [{ type: 'circle', cx: 12, cy: 12, r: 4.5, filled: true }] },
  { id: 'ring', label: 'Ring', shapes: [{ type: 'circle', cx: 12, cy: 12, r: 7 }] },
  { id: 'cross', label: 'Cross', shapes: [{ type: 'path', d: 'M6 6 L18 18 M18 6 L6 18' }] },
  { id: 'plus', label: 'Plus', shapes: [{ type: 'path', d: 'M12 4.5 V19.5 M4.5 12 H19.5' }] },
  { id: 'triangle', label: 'Triangle', shapes: [{ type: 'path', d: 'M12 4.5 L19.5 18 H4.5 Z' }] },
  { id: 'square', label: 'Square', shapes: [{ type: 'path', d: 'M5.5 5.5 H18.5 V18.5 H5.5 Z' }] },
  { id: 'diamond', label: 'Diamond', shapes: [{ type: 'path', d: 'M12 3.5 L20 12 L12 20.5 L4 12 Z' }] },
  // Drawn as a one-stroke pentagram — the way a star is actually inked.
  { id: 'star', label: 'Star', shapes: [{ type: 'path', d: 'M12 4.3 L17 19.7 L3.9 10.2 H20.1 L7 19.7 Z' }] },
  { id: 'chevron', label: 'Chevron', shapes: [{ type: 'path', d: 'M5 15.5 L12 8 L19 15.5' }] },
  { id: 'bar', label: 'Bar', shapes: [{ type: 'path', d: 'M5 12 H19' }] },
  { id: 'double-bar', label: 'Double bar', shapes: [{ type: 'path', d: 'M5 9 H19 M5 15 H19' }] },
  { id: 'crescent', label: 'Crescent', shapes: [{ type: 'path', d: 'M17.5 4.8 A8 8 0 1 0 17.5 19.2 A9 9 0 0 1 17.5 4.8 Z' }] },
];

const SYMBOLS_BY_ID = Object.fromEntries(MARKER_SYMBOLS.map((symbol) => [symbol.id, symbol]));

export function getMarkerSymbol(id) {
  return (id && SYMBOLS_BY_ID[id]) || null;
}

// The disc a symbol sits on is the miniature's base. Like map art it is content, not chrome:
// the same under every theme, so a mark reads on screen the way it does on the table. The
// base is dark; an ink too dark to read on it gets the pale base instead.
export const MARKER_BASES = {
  dark: { fill: '#1e1c1a', rim: '#6b655a', ink: '#f4efe4' },
  light: { fill: '#f4efe4', rim: '#8a8478', ink: '#1e1c1a' },
};
const DARK_INK_LUMINANCE = 0.08;

const channel = (value) => {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};

// Relative luminance (0 black to 1 white) of a #rgb or #rrggbb color; null for anything else.
export function inkLuminance(color) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color || '');
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1];
  const [red, green, blue] = [0, 2, 4].map((start) => channel(Number.parseInt(hex.slice(start, start + 2), 16)));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function markerBase(color) {
  const luminance = inkLuminance(color);
  return luminance !== null && luminance < DARK_INK_LUMINANCE ? MARKER_BASES.light : MARKER_BASES.dark;
}
