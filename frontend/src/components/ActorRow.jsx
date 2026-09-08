import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { getSheetValue, setSheetValue } from '../sheet';
import '../styles/ActorRow.css';

// See ActorTemplateLibrary: bare <input type="color"> ignores CSS sizing, so
// render a fixed-size swatch proxying a hidden native input.
function ColorSwatch({ color, onChange, onClear, title }) {
  const inputRef = useRef(null);
  return (
    <span className="color-swatch-wrap">
      <button
        type="button"
        className={`color-swatch ${color ? 'assigned' : ''}`}
        style={color ? { backgroundColor: color } : undefined}
        onClick={() => inputRef.current?.click()}
        title={title}
        aria-label={title}
      />
      <input
        ref={inputRef}
        type="color"
        className="color-swatch-input"
        value={color || '#6b5f4a'}
        onChange={(event) => onChange(event.target.value)}
        tabIndex={-1}
        aria-hidden="true"
      />
      {color && (
        <button type="button" className="btn-small" onClick={onClear} title="Clear marker color">
          ×
        </button>
      )}
    </span>
  );
}

function ActorRow({ actor, summaryFields }) {
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
    <div className="actor-row">
      <span className="col-name" onClick={handleSelect}>
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
