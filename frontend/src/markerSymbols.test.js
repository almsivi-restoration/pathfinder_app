import { MARKER_BASES, MARKER_SYMBOLS, getMarkerSymbol, inkLuminance, markerBase } from './markerSymbols';

test('unknown and empty ids resolve to nothing', () => {
  expect(getMarkerSymbol('star')).toBe(MARKER_SYMBOLS.find((symbol) => symbol.id === 'star'));
  expect(getMarkerSymbol('from-a-newer-build')).toBeNull();
  expect(getMarkerSymbol(null)).toBeNull();
});

test('ink luminance reads #rgb and #rrggbb and rejects anything else', () => {
  expect(inkLuminance('#000000')).toBe(0);
  expect(inkLuminance('#ffffff')).toBeCloseTo(1, 5);
  expect(inkLuminance('#FFF')).toBeCloseTo(1, 5);
  expect(inkLuminance('#3060d0')).toBeCloseTo(0.1355, 3);
  expect(inkLuminance('rebeccapurple')).toBeNull();
  expect(inkLuminance(null)).toBeNull();
});

// The base is the miniature's base: dark, unless the ink would vanish on it.
test('the base is dark for inks that read on it and pale for inks that would not', () => {
  for (const ink of ['#f8d030', '#e03838', '#30a050', '#3060d0', '#ffffff']) {
    expect(markerBase(ink)).toBe(MARKER_BASES.dark);
  }
  for (const ink of ['#000000', '#1b2347', '#3a2410']) {
    expect(markerBase(ink)).toBe(MARKER_BASES.light);
  }
  // No color, or one this build cannot read: the dark base with its own pale ink.
  expect(markerBase(null)).toBe(MARKER_BASES.dark);
  expect(markerBase('not-a-color')).toBe(MARKER_BASES.dark);
});
