import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { getSheetValue, setSheetValue } from '../sheet';
import '../styles/ActorRow.css';

function ActorRow({ actor, summaryFields }) {
  const removeActor = useStore((state) => state.removeActor);
  const updateActor = useStore((state) => state.updateActor);
  const setSelectedActorId = useStore((state) => state.setSelectedActorId);
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
