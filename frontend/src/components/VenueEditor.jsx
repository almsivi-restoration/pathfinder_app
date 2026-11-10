import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import VenueMap, { FeatureSwatch, TerrainSwatch, pointerToCell } from './VenueMap';
import MatGuide from './MatGuide';
import { VENUE_CELL as C, VENUE_FEATURES, VENUE_INK, VENUE_TERRAINS, getFeature } from '../venueCatalog';
import {
  addFeature,
  applyWall,
  cellLabel,
  cellsAlong,
  edgeSegment,
  edgeTouchesTerrain,
  edgesAlongLine,
  featureAt,
  inBounds,
  nearestEdge,
  newFeatureId,
  paintCells,
  rectCells,
  removeFeature,
  resizeVenue,
  rotateBy,
  showsWall,
  toggleEdgeKind,
  updateFeature,
  VENUE_MAX_SIDE,
} from '../venueGeometry';
import '../styles/VenueEditor.css';

const HISTORY_LIMIT = 100;
const ZOOM_LEVELS = [12, 16, 20, 24, 32, 40, 48, 56];
const DEFAULT_ZOOM = 24;

const icon = (children) => (
  <svg className="venue-tool-icon" viewBox="0 0 20 20" aria-hidden="true">{children}</svg>
);
const line = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
// Drawn, not typed: theme pixel fonts lack U+2212, which fell back to a hairline glyph.
const ZOOM_OUT_ICON = icon(<path d="M5 10h10" {...line} strokeWidth="2.4" />);
const ZOOM_IN_ICON = icon(<path d="M5 10h10M10 5v10" {...line} strokeWidth="2.4" />);
const ROTATE_LEFT_ICON = icon(
  <path d="M1.75 4v4.5h4.5M3.63 12.25a6.75 6.75 0 1 0 1.6-7.02L1.75 8.5" {...line} strokeWidth="1.9" />,
);
const ROTATE_RIGHT_ICON = icon(
  <path d="M18.25 4v4.5h-4.5M16.37 12.25a6.75 6.75 0 1 1-1.59-7.02L18.25 8.5" {...line} strokeWidth="1.9" />,
);

export const VENUE_TOOLS = [
  {
    id: 'room',
    label: 'Room',
    key: 'r',
    hint: 'Drag a rectangle to lay out a room; walls appear around it. Right-drag clears a rectangle.',
    icon: icon(<rect x="3.5" y="3.5" width="13" height="13" {...line} strokeWidth="2.6" />),
  },
  {
    id: 'paint',
    label: 'Paint',
    key: 'b',
    hint: 'Drag to paint the chosen terrain cell by cell. Right-drag erases.',
    icon: icon(<path d="M4 16.5c3 0 4.5-1.4 4.5-3.6L15.5 4l1.4 1.4-8.6 7.5" {...line} strokeWidth="1.8" />),
  },
  {
    id: 'erase',
    label: 'Erase',
    key: 'e',
    hint: 'Drag to clear cells back to empty space (and any stamps on them).',
    icon: icon(<path d="M3.5 12.5l7-7 6 6-5 5h-4.5zM7 9l6 6" {...line} strokeWidth="1.7" />),
  },
  {
    id: 'wall',
    label: 'Wall',
    key: 'w',
    hint: 'Click a grid line to add or remove a wall; drag to draw a straight run.',
    icon: icon(<path d="M3 10h14" {...line} strokeWidth="3.6" strokeLinecap="square" />),
  },
  {
    id: 'door',
    label: 'Door',
    key: 'd',
    hint: 'Click a grid line to place or remove a door.',
    icon: icon(
      <>
        <path d="M2.5 10h3M14.5 10h3" {...line} strokeWidth="3" strokeLinecap="square" />
        <rect x="5.5" y="7.5" width="9" height="5" {...line} strokeWidth="1.5" />
      </>,
    ),
  },
  {
    id: 'secret',
    label: 'Secret',
    key: 's',
    hint: 'Click a grid line to place or remove a secret door. Players only ever see a wall.',
    icon: icon(
      <>
        <path d="M2.5 13h15" {...line} strokeWidth="3" strokeLinecap="square" />
        <text x="10" y="9.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor">S</text>
      </>,
    ),
  },
  {
    id: 'stamp',
    label: 'Stamp',
    key: 'f',
    hint: 'Click a cell to place the chosen stamp; click it again to remove it.',
    icon: icon(
      <>
        <rect x="4" y="6" width="12" height="9" rx="1" {...line} strokeWidth="1.6" />
        <path d="M4 10h12M10 9v2.5" {...line} strokeWidth="1.6" />
      </>,
    ),
  },
  {
    id: 'select',
    label: 'Select',
    key: 'v',
    hint: 'Click a stamp to select it, drag to move it. [ and ] rotate, Delete removes.',
    icon: icon(<path d="M5.5 3v13l3.4-3.3 2.4 4.6 2-1-2.3-4.5 4.6-.2z" fill="currentColor" />),
  },
];
const TOOL_BY_KEY = Object.fromEntries(VENUE_TOOLS.map((tool) => [tool.key, tool.id]));
const EDGE_TOOLS = new Set(['wall', 'door', 'secret']);

const clampCell = (venue, point) => [
  Math.min(Math.max(Math.floor(point.x), 0), venue.width - 1),
  Math.min(Math.max(Math.floor(point.y), 0), venue.height - 1),
];

const isTyping = (target) => {
  const tag = target?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(target?.isContentEditable);
};

const clampSide = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), VENUE_MAX_SIDE);
};

// The venue map editor. Edits stay local until Save; name and notes sit outside the undo
// history so undoing a wall never reverts a rename.
export default function VenueEditor({ venue: initialVenue, onSave, onDirtyChange, shown = false, onShow, onHide }) {
  const [history, setHistory] = useState({ past: [], present: initialVenue, future: [] });
  const [name, setName] = useState(initialVenue.name);
  const [notes, setNotes] = useState(initialVenue.notes || '');
  const [saved, setSaved] = useState({ venue: initialVenue, name: initialVenue.name, notes: initialVenue.notes || '' });
  const [tool, setTool] = useState('room');
  const [terrain, setTerrain] = useState('floor');
  const [stampKind, setStampKind] = useState('chest');
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [hover, setHover] = useState(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingScreen, setTogglingScreen] = useState(false);
  const [matGuideOpen, setMatGuideOpen] = useState(false);
  const [sizeDraft, setSizeDraft] = useState({ width: String(initialVenue.width), height: String(initialVenue.height) });

  const svgRef = useRef(null);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const labelInputRef = useRef(null);
  const focusLabelRef = useRef(false);
  const labelEditRef = useRef(false);

  const { present } = history;
  const display = draft || present;
  const selectedFeature = present.features.find((feature) => feature.id === selectedFeatureId) || null;
  const dirty = present !== saved.venue || name !== saved.name || notes !== saved.notes;
  const activeTool = VENUE_TOOLS.find((entry) => entry.id === tool);
  // The guide draws the venue as it stands in the editor, unsaved edits included: it is GM-only.
  const matGuideVenue = useMemo(() => ({ ...present, name: name.trim() || present.name }), [present, name]);
  const closeMatGuide = useCallback(() => setMatGuideOpen(false), []);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    setSizeDraft({ width: String(present.width), height: String(present.height) });
  }, [present.width, present.height]);

  useEffect(() => {
    if (focusLabelRef.current && labelInputRef.current) {
      labelInputRef.current.focus();
      focusLabelRef.current = false;
    }
  }, [selectedFeatureId]);

  const commit = useCallback((next) => {
    setHistory((current) => (next === current.present ? current : {
      past: [...current.past, current.present].slice(-HISTORY_LIMIT),
      present: next,
      future: [],
    }));
  }, []);

  // Replace the present without a new undo step (continuous typing into one field).
  const replace = useCallback((next) => {
    setHistory((current) => ({ ...current, present: next }));
  }, []);

  const undo = useCallback(() => {
    setHistory((current) => (current.past.length ? {
      past: current.past.slice(0, -1),
      present: current.past[current.past.length - 1],
      future: [current.present, ...current.future],
    } : current));
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => (current.future.length ? {
      past: [...current.past, current.present],
      present: current.future[0],
      future: current.future.slice(1),
    } : current));
  }, []);

  const fitZoom = useCallback(() => {
    const element = canvasRef.current;
    if (!element || !element.clientWidth || !element.clientHeight) return;
    const px = Math.floor(Math.min(
      (element.clientWidth - 24) / (present.width + 1),
      (element.clientHeight - 24) / (present.height + 1),
    ));
    setZoom(Math.max(8, Math.min(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], px)));
  }, [present.width, present.height]);

  // Fit once when the editor opens on a venue.
  const fittedRef = useRef(false);
  useLayoutEffect(() => {
    if (fittedRef.current) return;
    fittedRef.current = true;
    fitZoom();
  }, [fitZoom]);

  const zoomIn = () => setZoom((current) => ZOOM_LEVELS.find((level) => level > current) || current);
  const zoomOut = () => setZoom((current) => [...ZOOM_LEVELS].reverse().find((level) => level < current) || current);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return false;
    setSaving(true);
    const toSave = { ...present, name: trimmed, notes };
    const result = await onSave(toSave);
    setSaving(false);
    if (result) {
      setName(trimmed);
      setSaved({ venue: present, name: trimmed, notes });
    }
    return Boolean(result);
  }, [name, notes, onSave, present, saving]);

  // The Venue Screen draws the saved copy, so showing unsaved work saves it first.
  const canToggleScreen = Boolean(onShow && onHide) && !togglingScreen && !saving && (shown || !dirty || Boolean(name.trim()));
  const toggleScreen = async () => {
    if (!canToggleScreen) return;
    setTogglingScreen(true);
    if (shown) await onHide();
    else if (!dirty || await handleSave()) await onShow();
    setTogglingScreen(false);
  };

  const removeSelected = useCallback(() => {
    if (!selectedFeatureId) return;
    commit(removeFeature(present, selectedFeatureId));
    setSelectedFeatureId(null);
  }, [commit, present, selectedFeatureId]);

  const rotateSelected = useCallback((step) => {
    if (!selectedFeature) return;
    commit(updateFeature(present, selectedFeature.id, { rotation: rotateBy(selectedFeature.rotation, step) }));
  }, [commit, present, selectedFeature]);

  // Keyboard shortcuts read the latest state through a ref so the listener attaches once.
  const keyHandlerRef = useRef(null);
  keyHandlerRef.current = (event) => {
    if (matGuideOpen) return; // the guide is modal; it handles its own Escape
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (modifier && key === 's') {
      event.preventDefault();
      handleSave();
      return;
    }
    if (isTyping(event.target) || event.altKey) return;
    if (modifier && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
      return;
    }
    if (modifier && key === 'y') {
      event.preventDefault();
      redo();
      return;
    }
    // Player preview pauses editing: the toolbar is disabled and the selection hidden, so
    // the keys that would switch tools or change the hidden selection pause too.
    if (modifier || preview) return;
    if (TOOL_BY_KEY[key]) {
      setTool(TOOL_BY_KEY[key]);
    } else if (key === 'delete' || key === 'backspace') {
      if (selectedFeatureId) {
        event.preventDefault();
        removeSelected();
      }
    } else if (key === '[' || key === ']') {
      rotateSelected(key === '[' ? -90 : 90);
    } else if (key === 'escape') {
      setSelectedFeatureId(null);
    }
  };
  useEffect(() => {
    const listener = (event) => keyHandlerRef.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const toCell = (event) => pointerToCell(svgRef.current, present, event.clientX, event.clientY);

  const beginDrag = (info, next) => {
    dragRef.current = { ...info, base: present, draft: next };
    setDraft(next);
  };
  const updateDrag = (next) => {
    dragRef.current.draft = next;
    setDraft(next);
  };

  const handlePointerDown = (event) => {
    if (preview || (event.button !== 0 && event.button !== 2)) return;
    const point = toCell(event);
    const [x, y] = [Math.floor(point.x), Math.floor(point.y)];
    const rightButton = event.button === 2;
    event.currentTarget.setPointerCapture?.(event.pointerId);

    if (tool === 'room') {
      const start = clampCell(present, point);
      const paint = rightButton ? null : terrain;
      beginDrag({ kind: 'room', start, terrain: paint }, paintCells(present, [start], paint));
    } else if (tool === 'paint' || tool === 'erase') {
      const paint = tool === 'erase' || rightButton ? null : terrain;
      beginDrag({ kind: 'paint', last: point, terrain: paint }, paintCells(present, [[x, y]], paint));
    } else if (tool === 'wall') {
      const edge = nearestEdge(present, point.x, point.y);
      const wantWall = !showsWall(present, edge.x, edge.y, edge.side);
      beginDrag({ kind: 'wall', start: point, edge, wantWall }, applyWall(present, edge.x, edge.y, edge.side, wantWall));
    } else if (tool === 'door' || tool === 'secret') {
      const edge = nearestEdge(present, point.x, point.y);
      if (edgeTouchesTerrain(present, edge.x, edge.y, edge.side)) {
        commit(toggleEdgeKind(present, edge.x, edge.y, edge.side, tool === 'door' ? 'door' : 'secret_door'));
      }
    } else if (tool === 'stamp') {
      if (!inBounds(present, x, y)) return;
      const existing = featureAt(present, x, y);
      if (existing && existing.kind === stampKind) {
        commit(removeFeature(present, existing.id));
        setSelectedFeatureId(null);
        return;
      }
      const definition = getFeature(stampKind);
      const id = newFeatureId();
      commit(addFeature(present, { id, kind: stampKind, x, y, gm_only: Boolean(definition.defaultGmOnly) }));
      focusLabelRef.current = Boolean(definition.text);
      setSelectedFeatureId(id);
    } else if (tool === 'select') {
      const feature = inBounds(present, x, y) ? featureAt(present, x, y) : null;
      setSelectedFeatureId(feature?.id || null);
      if (feature) beginDrag({ kind: 'move', featureId: feature.id }, present);
    }
  };

  const handlePointerMove = (event) => {
    const point = toCell(event);
    setHover(point);
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === 'room') {
      const [ex, ey] = clampCell(present, point);
      updateDrag(paintCells(drag.base, rectCells(drag.start[0], drag.start[1], ex, ey), drag.terrain));
    } else if (drag.kind === 'paint') {
      updateDrag(paintCells(drag.draft, cellsAlong(drag.last.x, drag.last.y, point.x, point.y), drag.terrain));
      drag.last = point;
    } else if (drag.kind === 'wall') {
      const moved = Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 0.35;
      const edges = moved ? edgesAlongLine(drag.base, drag.start.x, drag.start.y, point.x, point.y) : [drag.edge];
      updateDrag(edges.reduce((venue, edge) => applyWall(venue, edge.x, edge.y, edge.side, drag.wantWall), drag.base));
    } else if (drag.kind === 'move') {
      const [mx, my] = clampCell(present, point);
      updateDrag(updateFeature(drag.base, drag.featureId, { x: mx, y: my }));
    }
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDraft(null);
    if (drag && drag.draft !== drag.base) commit(drag.draft);
  };

  const handlePointerCancel = () => {
    dragRef.current = null;
    setDraft(null);
  };

  const applySize = () => {
    const width = clampSide(sizeDraft.width, present.width);
    const height = clampSide(sizeDraft.height, present.height);
    const resized = resizeVenue(present, width, height);
    if (resized === present) {
      setSizeDraft({ width: String(width), height: String(height) });
      return;
    }
    const lostCells = Object.keys(present.cells).length - Object.keys(resized.cells).length;
    const lostStamps = present.features.length - resized.features.length;
    if ((lostCells || lostStamps) && !window.confirm(
      `Shrinking to ${width}×${height} removes ${lostCells} painted squares and ${lostStamps} stamps. Continue?`,
    )) return;
    commit(resized);
  };

  const editSelected = (patch) => {
    if (!selectedFeature) return;
    const next = updateFeature(present, selectedFeature.id, patch);
    if (labelEditRef.current) {
      replace(next);
    } else {
      labelEditRef.current = true;
      commit(next);
    }
  };

  const pickTerrain = (terrainId) => {
    setTerrain(terrainId);
    if (tool !== 'room' && tool !== 'paint') setTool('room');
  };
  const pickStamp = (kind) => {
    setStampKind(kind);
    setTool('stamp');
  };

  let overlay = null;
  if (hover && !preview && !dragRef.current) {
    if (EDGE_TOOLS.has(tool)) {
      const edge = nearestEdge(display, hover.x, hover.y);
      const segment = edgeSegment(edge.x, edge.y, edge.side);
      const ends = { x1: segment.x1 * C, y1: segment.y1 * C, x2: segment.x2 * C, y2: segment.y2 * C };
      overlay = (
        <>
          <line className="venue-map-casing venue-hover-edge-casing" stroke={VENUE_INK} {...ends} />
          <line className="venue-hover-edge" {...ends} />
        </>
      );
    } else {
      const [hx, hy] = [Math.floor(hover.x), Math.floor(hover.y)];
      if (inBounds(display, hx, hy)) {
        const box = { x: hx * C, y: hy * C, width: C, height: C };
        overlay = (
          <>
            <rect className="venue-map-casing venue-hover-cell-casing" fill="none" stroke={VENUE_INK} {...box} />
            <rect className="venue-hover-cell" {...box} />
          </>
        );
      }
    }
  }

  const hoverCell = hover && inBounds(present, Math.floor(hover.x), Math.floor(hover.y))
    ? cellLabel(Math.floor(hover.x), Math.floor(hover.y))
    : '—';
  const selectedDefinition = selectedFeature ? getFeature(selectedFeature.kind) : null;

  return (
    <div className="venue-editor">
      <div className="venue-toolbar" role="toolbar" aria-label="Venue tools">
        <div className="venue-toolbar-group">
          {VENUE_TOOLS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`btn venue-tool${tool === entry.id ? ' active' : ''}`}
              aria-pressed={tool === entry.id}
              title={`${entry.label} (${entry.key.toUpperCase()}) — ${entry.hint}`}
              onClick={() => setTool(entry.id)}
              disabled={preview}
            >
              {entry.icon}
              <span>{entry.label}</span>
            </button>
          ))}
        </div>
        <div className="venue-toolbar-group">
          <button type="button" className="btn venue-tool" onClick={undo} disabled={!history.past.length} title="Undo (Ctrl+Z)">Undo</button>
          <button type="button" className="btn venue-tool" onClick={redo} disabled={!history.future.length} title="Redo (Ctrl+Y)">Redo</button>
        </div>
        <div className="venue-toolbar-group">
          <button type="button" className="btn venue-tool" onClick={zoomOut} aria-label="Zoom out" title="Zoom out">{ZOOM_OUT_ICON}</button>
          <button type="button" className="btn venue-tool" onClick={fitZoom} title="Fit the map to the window">Fit</button>
          <button type="button" className="btn venue-tool" onClick={zoomIn} aria-label="Zoom in" title="Zoom in">{ZOOM_IN_ICON}</button>
        </div>
        <div className="venue-toolbar-group venue-toolbar-end">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setMatGuideOpen(true)}
            title="How to draw this venue on the table mat"
          >
            Mat Guide
          </button>
          <label className="venue-preview-toggle" title="Show exactly what the players will see">
            <input type="checkbox" checked={preview} onChange={(event) => setPreview(event.target.checked)} />
            Player preview
          </label>
          {onShow && onHide && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={toggleScreen}
              disabled={!canToggleScreen}
              title={shown
                ? 'Take this venue off the Venue Screen'
                : `${dirty ? 'Save, then put' : 'Put'} this venue on the Venue Screen`}
            >
              {shown ? 'Hide from players' : 'Show players'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!dirty || saving || !name.trim()}
            title="Save (Ctrl+S)"
          >
            {saving ? 'Saving' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="venue-editor-body">
        <div className={`venue-canvas${preview ? ' previewing' : ''}`} ref={canvasRef} data-tool={tool}>
          <VenueMap
            venue={display}
            mode={preview ? 'player' : 'gm'}
            pxPerCell={zoom}
            editorGrid={!preview}
            selectedFeatureId={preview ? null : selectedFeatureId}
            svgRef={svgRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={() => setHover(null)}
            onContextMenu={(event) => event.preventDefault()}
          >
            {overlay}
          </VenueMap>
        </div>

        <aside className="venue-sidebar">
          <section className="venue-sidebar-section">
            <h3>Terrain</h3>
            <div className="venue-palette">
              {VENUE_TERRAINS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`venue-palette-item${terrain === entry.id ? ' active' : ''}`}
                  aria-pressed={terrain === entry.id}
                  onClick={() => pickTerrain(entry.id)}
                  disabled={preview}
                >
                  <TerrainSwatch terrainId={entry.id} />
                  <span>{entry.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="venue-sidebar-section">
            <h3>Stamps</h3>
            <div className="venue-palette venue-palette-stamps">
              {VENUE_FEATURES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`venue-palette-item${tool === 'stamp' && stampKind === entry.id ? ' active' : ''}`}
                  aria-pressed={tool === 'stamp' && stampKind === entry.id}
                  onClick={() => pickStamp(entry.id)}
                  title={entry.defaultGmOnly ? `${entry.label} (hidden from players)` : entry.label}
                  disabled={preview}
                >
                  <FeatureSwatch kind={entry.id} />
                  <span>{entry.label}</span>
                </button>
              ))}
            </div>
          </section>

          {selectedFeature && !preview && (
            <section className="venue-sidebar-section venue-inspector" aria-label="Selected stamp">
              <h3>{selectedDefinition.label}</h3>
              <label className="venue-field">
                <span>{selectedDefinition.text ? 'Text' : 'Label (shown on hover)'}</span>
                <input
                  ref={labelInputRef}
                  type="text"
                  maxLength={80}
                  value={selectedFeature.label || ''}
                  onFocus={() => { labelEditRef.current = false; }}
                  onChange={(event) => editSelected({ label: event.target.value })}
                />
              </label>
              <div className="venue-inspector-row">
                <button type="button" className="btn-small btn-edit venue-icon-button" onClick={() => rotateSelected(-90)} aria-label="Rotate left" title="Rotate left ([)">
                  {ROTATE_LEFT_ICON}
                  <span>Rotate</span>
                </button>
                <button type="button" className="btn-small btn-edit venue-icon-button" onClick={() => rotateSelected(90)} aria-label="Rotate right" title="Rotate right (])">
                  {ROTATE_RIGHT_ICON}
                  <span>Rotate</span>
                </button>
                <button type="button" className="btn-small" onClick={removeSelected} title="Remove (Delete)">Remove</button>
              </div>
              <label className="venue-check">
                <input
                  type="checkbox"
                  checked={Boolean(selectedFeature.gm_only)}
                  onChange={(event) => commit(updateFeature(present, selectedFeature.id, { gm_only: event.target.checked }))}
                />
                GM only — hidden from players
              </label>
            </section>
          )}

          <section className="venue-sidebar-section">
            <h3>Venue</h3>
            <label className="venue-field">
              <span>Name</span>
              <input type="text" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <div className="venue-field">
              <span>Size (squares)</span>
              <div className="venue-size-row">
                <input
                  type="number"
                  min="1"
                  max={VENUE_MAX_SIDE}
                  aria-label="Width in squares"
                  value={sizeDraft.width}
                  onChange={(event) => setSizeDraft({ ...sizeDraft, width: event.target.value })}
                />
                <span>×</span>
                <input
                  type="number"
                  min="1"
                  max={VENUE_MAX_SIDE}
                  aria-label="Height in squares"
                  value={sizeDraft.height}
                  onChange={(event) => setSizeDraft({ ...sizeDraft, height: event.target.value })}
                />
                <button type="button" className="btn-small btn-edit" onClick={applySize}>Apply</button>
              </div>
            </div>
            <label className="venue-field">
              <span>GM notes (never shown to players)</span>
              <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
          </section>
        </aside>
      </div>

      <div className="venue-status" aria-live="polite">
        <span className="venue-status-cell">{hoverCell}</span>
        <span className="venue-status-hint">{preview ? 'Player preview — editing is paused.' : activeTool?.hint}</span>
        <span className="venue-status-size">
          {present.width}×{present.height} squares{dirty ? ' · unsaved changes' : ''}
        </span>
      </div>
      {matGuideOpen && <MatGuide venue={matGuideVenue} onClose={closeMatGuide} />}
    </div>
  );
}
