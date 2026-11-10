---
description: "Blueprint: frontend-owned content catalogs whose ids are persisted (marker symbols, venue terrains/edges/stamps) — append-only ids, opaque backend storage, visible fallbacks, physical-mat translation, and server-side GM-only stripping. Load when adding or editing a catalog entry or a renderer that reads one."
name: "bp-content-catalog"
version: "1.0.0"
applyTo: "frontend/src/markerSymbols.js, frontend/src/venueCatalog.jsx, frontend/src/components/MarkerSymbol.jsx, frontend/src/components/SymbolPicker.jsx, frontend/src/components/Venue*.jsx, frontend/src/components/Mat*.jsx, frontend/src/matGuide.js, frontend/src/venueGeometry.js"
---

# Blueprint: Content Catalog

## Purpose

Some content is a fixed vocabulary of drawable pieces — the marker symbols
a GM inks on a miniature base, the terrains, grid-line kinds, and stamps a
Venue is built from. One frontend file owns each vocabulary; every screen
that draws a piece (editor palette, Venue Screen, Mat Guide, actor rows)
reads it from there. Saved data holds only the ids, so the catalog is a
compatibility surface, not just a style sheet.

## Holotype

[markerSymbols.js](../../frontend/src/markerSymbols.js) is the minimal
form — a list of entries and a lookup that returns `null` for anything it
does not know:

```js
// Ids are persisted on actors (Actor.symbol) — never rename one, only add.
export const MARKER_SYMBOLS = [
  { id: 'dot', label: 'Dot', shapes: [{ type: 'circle', cx: 12, cy: 12, r: 4.5, filled: true }] },
  // ...
];

export function getMarkerSymbol(id) {
  return (id && SYMBOLS_BY_ID[id]) || null;
}
```

[venueCatalog.jsx](../../frontend/src/venueCatalog.jsx) is the full form:
`VENUE_TERRAINS`, `VENUE_EDGE_KINDS`, and `VENUE_FEATURES`, each entry
carrying its screen art (`draw`/fill) and its mat translation (`mat`),
with `getTerrain`/`getFeature`/`getEdgeKind` falling back to an
"unknown" entry.

## Contract

- **One entry, every surface.** Adding a piece means adding one catalog
  entry; renderers, palettes, and the Mat Guide derive from the list.
  Never special-case a piece id inside a component.
- **Ids are append-only.** Persisted ids (`Actor.symbol`; venue `cells`
  values, `edges[].kind`, `features[].kind`) are never renamed or
  removed. Retire a piece by hiding it from the palette, not by deleting
  its entry.
- **The backend stores ids opaquely.** Models bound the string length
  (`max_length=32`) but never validate against the catalog, so a newer
  build's ids survive a round trip through an older backend.
- **Unknown ids degrade visibly or silently, never fatally.** Venue
  lookups return a placeholder (plain floor, a dashed `?` box, a wall);
  `MarkerSymbol` renders nothing. No renderer may throw on an unknown id.
- **A marker symbol is always drawn on its base.** `MarkerSymbol` draws
  the mark in the actor's color on the miniature's base disc
  (`MARKER_BASES` in `markerSymbols.js`), the same on every screen and
  under every theme. The base is dark; `markerBase` swaps to the pale base
  for an ink too dark to read on it. A base painted from a theme surface
  token put a yellow star on a white disc under the light skins.
- **Every piece is hand-drawable.** Marker symbols are a few strokes one
  dry-erase marker can ink on a base; every venue entry declares a `mat`
  translation (one of the four `MAT_COLORS` plus a glyph or hint) so the
  Mat Guide can tell the GM exactly what to draw.
- **Catalog art is content, not chrome.** Fills, inks, mat colors, and
  the marker bases are constants in the catalog, not `--mw-*` tokens: a
  map or a marker must look the same under every theme, on the Venue
  Screen, and on the table. (Recorded deviation in the
  react-component-pair blueprint.) UI around the map — toolbars, panels,
  buttons — still uses tokens and composes on `.btn`.
- **Theme-colored cues on content ride on an ink casing.** The editor's
  hover and selection cues use the theme accent but sit on the map's fixed
  paper, where a pale accent (Morrowind's gold, about 1.5:1) washes out.
  Each accent stroke is drawn over a wider `.venue-map-casing` stroke in
  `VENUE_INK`.
- **A mat mark that is a shape says what to draw.** The legend hint
  defaults to `Write <glyph>`; an entry whose glyph is not letters sets
  `mat.hint` (the pillar's "Fill in a dot").
- **The printed Mat Guide is content too.** It prints as plain ink in the
  base faces under every theme; its print rules are scoped under
  `body.mat-guide-open` so no skin can restyle the page (checked by
  `themeSelectorContract.test.js`).
- **GM-only is enforced on the server.** A catalog `gmOnly` edge kind
  needs a disguise in `_PLAYER_EDGE_DISGUISES` (`backend/state.py`), and
  per-feature `gm_only` stamps are dropped by `player_venue_view` before
  the Venue Screen ever receives them. The frontend's player mode is a
  display preview, not the security boundary.
- **Drawing is deterministic.** Procedural texture (rock hatching, grass
  tufts, water ripples, flagstones, planks) uses `seededRandom`, so
  renders are stable across reloads and in tests.

## When this doesn't fit

GM-authored pieces (an uploaded token image, a custom stamp) are user
data, not catalog entries: they need persistence, a schema, and an
import/export story, and would extend the Venue model rather than this
file. A catalog that grows a second consumer domain (e.g. Scenes reading
venue pieces) keeps one owning file and exports lookups — it does not fork.
