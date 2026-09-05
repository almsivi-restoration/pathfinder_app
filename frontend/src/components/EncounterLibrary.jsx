import React from 'react';
import { useStore } from '../store';
import '../styles/EncounterLibrary.css';

function EncounterLibrary() {
  const encounters = useStore((state) => state.campaignEncounters);
  const loadEncounter = useStore((state) => state.loadEncounter);
  const deleteEncounter = useStore((state) => state.deleteEncounter);
  const clearOperationError = useStore((state) => state.clearOperationError);

  const handleLoad = async (encounterId) => {
    clearOperationError();
    await loadEncounter(encounterId);
  };

  const handleDelete = async (encounter) => {
    if (window.confirm(`Delete ${encounter.name}? This cannot be undone.`)) {
      clearOperationError();
      await deleteEncounter(encounter.id);
    }
  };

  if (encounters.length === 0) {
    return <div className="encounter-library empty">No saved encounters yet.</div>;
  }

  return (
    <div className="encounter-library">
      {encounters.map((encounter) => (
        <div className="encounter-library-row" key={encounter.id}>
          <div>
            <strong>{encounter.name}</strong>
            <span>{encounter.actors.length} actors · Round {encounter.current_round || 0}</span>
          </div>
          <div className="encounter-library-actions">
            <button className="btn-small btn-add" onClick={() => handleLoad(encounter.id)}>Load</button>
            <button className="btn-small" onClick={() => handleDelete(encounter)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default EncounterLibrary;