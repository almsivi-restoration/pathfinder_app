import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { getSheetValue, setSheetValue } from '../sheet';
import ColorSwatch from './ColorSwatch';
import SymbolPicker from './SymbolPicker';
import '../styles/ActorRow.css';

function ActorRow({ actor, summaryFields, isCurrent = false }) {
  const removeActor = useStore((state) => state.removeActor);
  const updateActor = useStore((state) => state.updateActor);
  const addActor = useStore((state) => state.addActor);
  const setSelectedActorId = useStore((state) => state.setSelectedActorId);
  const setViewingActorId = useStore((state) => state.setViewingActorId);
  const resource = summaryFields.find((field) => field.secondary_key);
  const [isEditing, setIsEditing] = useState(false);
  const [editedResource, setEditedResource] = useState('');

  useEffect(() => {
    if (resource) setEditedResource(getSheetValue(actor.sheet, resource.value_key, ''));
  }, [actor, resource]);

  const handleRemove = async () => {
    if (window.confirm(`Remove ${actor.name}?`)) {
      await removeActor(actor.id);
    }
  };

  const handleClone = async () => {
    await addActor({
      ...actor,
      id: '',
      effects: [],
      initiative_roll: null,
      created_at: undefined,
    });
  };

  const handleColorChange = async (color) => {
    await updateActor(actor.id, { ...actor, color });
  };

  const handleColorClear = async () => {
    await updateActor(actor.id, { ...actor, color: null });
  };

  const handleSymbolChange = async (symbol) => {
    await updateActor(actor.id, { ...actor, symbol });
  };

  const handleResourceChange = async () => {
    if (!resource) return;
    const updatedActor = {
      ...actor,
      sheet: setSheetValue(actor.sheet, resource.value_key, Number(editedResource)),
    };
    await updateActor(actor.id, updatedActor);
    setIsEditing(false);
  };

  const handleSelect = () => {
    setSelectedActorId(actor.id);
  };

  return (
    <div
      className={`actor-row ${isCurrent ? 'current-turn' : ''}`}
      aria-current={isCurrent ? 'true' : undefined}
    >
      <span className="col-name" onClick={handleSelect} title={isCurrent ? 'Current turn' : undefined}>
        {isCurrent && <span className="turn-marker" aria-hidden="true">▶</span>}
        {actor.name}
      </span>
      <span className="col-type">{actor.is_pc ? 'PC' : 'NPC'}</span>
      {summaryFields.map((field) => {
        const value = getSheetValue(actor.sheet, field.value_key, '-');
        const displayValue = field.secondary_key
          ? `${value}/${getSheetValue(actor.sheet, field.secondary_key, '-')}`
          : `${field.signed && Number(value) >= 0 ? '+' : ''}${value}`;
        const isResource = field === resource;
        return (
          <span key={field.value_key} className={`col-stat ${isResource ? 'editable-stat' : ''}`}>
            {isResource && isEditing ? (
              <input
                type="number"
                value={editedResource}
                onChange={(event) => setEditedResource(event.target.value)}
                onBlur={handleResourceChange}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleResourceChange();
                  } else if (event.key === 'Escape') {
                    // Reset first so a trailing blur re-commits the untouched
                    // value instead of the discarded edit.
                    setEditedResource(getSheetValue(actor.sheet, resource.value_key, ''));
                    setIsEditing(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <span onClick={() => isResource && setIsEditing(true)}>{displayValue}</span>
            )}
          </span>
        );
      })}
      <span className="col-actions">
        <ColorSwatch
          color={actor.color}
          onChange={(color) => handleColorChange(color)}
          onClear={handleColorClear}
          title={actor.color ? `Marker color ${actor.color}` : 'Assign a marker color (shown on the player view)'}
        />
        <SymbolPicker
          symbol={actor.symbol}
          color={actor.color}
          onChange={handleSymbolChange}
        />
        <button className="btn-small" onClick={() => setViewingActorId(actor.id)} title="View actor details">
          View
        </button>
        <button className="btn-small btn-add" onClick={handleClone} title="Duplicate this actor">
          Clone
        </button>
        <button className="btn-small btn-edit" onClick={handleSelect}>
          Edit
        </button>
        <button className="btn-small" onClick={handleRemove}>
          Remove
        </button>
      </span>
    </div>
  );
}

export default ActorRow;
