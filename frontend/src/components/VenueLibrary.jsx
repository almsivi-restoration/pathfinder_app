import React, { useState } from 'react';
import { VENUE_MAX_SIDE } from '../venueGeometry';
import { MAT_DEFAULT_SIZE } from '../matGuide';
import '../styles/VenueLibrary.css';

const { columns: matColumns, rows: matRows } = MAT_DEFAULT_SIZE;

export const VENUE_SIZE_PRESETS = [
  { id: 'mat-landscape', label: `Whole mat, landscape (${matRows}×${matColumns})`, width: matRows, height: matColumns },
  { id: 'mat-portrait', label: `Whole mat, portrait (${matColumns}×${matRows})`, width: matColumns, height: matRows },
  { id: 'half-mat', label: `Half mat (${matColumns}×${matRows / 2})`, width: matColumns, height: matRows / 2 },
  { id: 'dungeon', label: 'Dungeon (24×24)', width: 24, height: 24 },
  { id: 'room', label: 'Single room (12×12)', width: 12, height: 12 },
  { id: 'custom', label: 'Custom size' },
];

const toSide = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : Math.min(Math.max(parsed, 1), VENUE_MAX_SIDE);
};

export default function VenueLibrary({ venues, selectedId, shownVenueId, onSelect, onCreate, onDelete }) {
  const [name, setName] = useState('');
  const [presetId, setPresetId] = useState(VENUE_SIZE_PRESETS[0].id);
  const [custom, setCustom] = useState({ width: '20', height: '20' });
  const [creating, setCreating] = useState(false);

  const preset = VENUE_SIZE_PRESETS.find((entry) => entry.id === presetId);
  const width = preset.width ?? toSide(custom.width);
  const height = preset.height ?? toSide(custom.height);
  const canCreate = Boolean(name.trim()) && Boolean(width) && Boolean(height) && !creating;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    const created = await onCreate({ name: name.trim(), width, height });
    setCreating(false);
    if (created) setName('');
  };

  return (
    <aside className="venue-library" aria-label="Venue library">
      <form className="venue-library-new" onSubmit={handleSubmit}>
        <h2>New venue</h2>
        <input
          type="text"
          placeholder="Name, e.g. Sunken Chapel"
          aria-label="New venue name"
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <select aria-label="New venue size" value={presetId} onChange={(event) => setPresetId(event.target.value)}>
          {VENUE_SIZE_PRESETS.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.label}</option>
          ))}
        </select>
        {presetId === 'custom' && (
          <div className="venue-library-custom">
            <input
              type="number"
              min="1"
              max={VENUE_MAX_SIDE}
              aria-label="New venue width"
              value={custom.width}
              onChange={(event) => setCustom({ ...custom, width: event.target.value })}
            />
            <span>×</span>
            <input
              type="number"
              min="1"
              max={VENUE_MAX_SIDE}
              aria-label="New venue height"
              value={custom.height}
              onChange={(event) => setCustom({ ...custom, height: event.target.value })}
            />
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={!canCreate}>
          {creating ? 'Creating' : 'Create venue'}
        </button>
      </form>

      <h2>Venues</h2>
      {venues.length === 0 ? (
        <p className="venue-library-empty">No venues yet. Name one above to start drawing.</p>
      ) : (
        <ul className="venue-library-list">
          {venues.map((venue) => (
            <li key={venue.id} className={`venue-library-row${venue.id === selectedId ? ' selected' : ''}`}>
              <button
                type="button"
                className="venue-library-open"
                onClick={() => onSelect(venue.id)}
                aria-current={venue.id === selectedId ? 'true' : undefined}
              >
                <span className="venue-library-name">{venue.name}</span>
                <span className="venue-library-meta">
                  {venue.width}×{venue.height}{venue.id === shownVenueId ? ' · on the Venue Screen' : ''}
                </span>
              </button>
              <button type="button" className="btn-small" onClick={() => onDelete(venue.id)} aria-label={`Delete ${venue.name}`}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
