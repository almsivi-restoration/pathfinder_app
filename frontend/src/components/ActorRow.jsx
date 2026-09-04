import React, { useState } from 'react';
import { useStore } from '../store';
import '../styles/ActorRow.css';

function ActorRow({ actor }) {
  const removeActor = useStore((state) => state.removeActor);
  const updateActor = useStore((state) => state.updateActor);
  const setSelectedActorId = useStore((state) => state.setSelectedActorId);
  const [isEditing, setIsEditing] = useState(false);
  const [editedHp, setEditedHp] = useState(actor.hp_current);

  const handleRemove = async () => {
    if (window.confirm(`Remove ${actor.name}?`)) {
      await removeActor(actor.id);
    }
  };

  const handleHpChange = async () => {
    const updatedActor = { ...actor, hp_current: parseInt(editedHp) };
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
      <span className="col-hp">
        {isEditing ? (
          <input
            type="number"
            value={editedHp}
            onChange={(e) => setEditedHp(e.target.value)}
            onBlur={handleHpChange}
            autoFocus
          />
        ) : (
          <span onClick={() => setIsEditing(true)}>
            {actor.hp_current}/{actor.hp_max}
          </span>
        )}
      </span>
      <span className="col-ac">{actor.ac}</span>
      <span className="col-init">+{actor.initiative_bonus}</span>
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
