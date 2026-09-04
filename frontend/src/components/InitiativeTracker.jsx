import React, { useState } from 'react';
import { useStore } from '../store';
import '../styles/InitiativeTracker.css';

function InitiativeTracker() {
  const currentEncounter = useStore((state) => state.currentEncounter);
  const actors = useStore((state) => state.actors);
  const initiativeOrder = useStore((state) => state.initiativeOrder);
  const currentRound = useStore((state) => state.currentRound);
  const currentTurnIndex = useStore((state) => state.currentTurnIndex);
  const isEncounterActive = useStore((state) => state.isEncounterActive);
  const nextTurn = useStore((state) => state.nextTurn);
  const setInitiativeOrder = useStore((state) => state.setInitiativeOrder);
  const updateActor = useStore((state) => state.updateActor);

  // Local editable order: falls back to actors' encounter order until the GM saves one explicitly.
  const [localOrder, setLocalOrder] = useState(null);

  if (!currentEncounter) {
    return <div className="initiative-tracker">No encounter loaded</div>;
  }

  const getActor = (actorId) => actors.find((a) => a.id === actorId);

  const orderedIds = localOrder || (initiativeOrder.length > 0 ? initiativeOrder : actors.map((a) => a.id));

  const handleInitiativeRollChange = async (actorId, value) => {
    const actor = getActor(actorId);
    if (!actor) return;
    const parsed = value === '' ? null : parseInt(value, 10);
    await updateActor(actorId, { ...actor, initiative_roll: parsed });
  };

  const handleSortByRoll = () => {
    const sorted = [...orderedIds].sort((a, b) => {
      const rollA = getActor(a)?.initiative_roll ?? -Infinity;
      const rollB = getActor(b)?.initiative_roll ?? -Infinity;
      return rollB - rollA;
    });
    setLocalOrder(sorted);
  };

  const handleMove = (index, direction) => {
    const next = [...orderedIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setLocalOrder(next);
  };

  const handleSaveOrder = async () => {
    await setInitiativeOrder(orderedIds);
    setLocalOrder(null);
  };

  const handleNextTurn = async () => {
    await nextTurn();
  };

  return (
    <div className="initiative-tracker">
      <h2>Initiative</h2>

      {isEncounterActive && (
        <div className="initiative-active">
          <div className="round-info">
            <strong>Round: {currentRound}</strong>
          </div>
          <button className="btn btn-primary" onClick={handleNextTurn}>
            Next Turn
          </button>
        </div>
      )}

      <div className="initiative-controls">
        <button className="btn btn-secondary" onClick={handleSortByRoll}>
          Sort by Roll
        </button>
        <button className="btn btn-primary" onClick={handleSaveOrder}>
          {isEncounterActive ? 'Update Order' : 'Start Encounter'}
        </button>
      </div>

      <div className="initiative-order">
        <h3>Order</h3>
        <p className="hint">
          Enter each actor's rolled initiative (physical die + bonus), or use the arrows to set order manually.
        </p>
        {orderedIds.map((actorId, index) => {
          const actor = getActor(actorId);
          if (!actor) return null;
          const isCurrent = isEncounterActive && index === currentTurnIndex;
          return (
            <div key={actorId} className={`initiative-item ${isCurrent ? 'active' : ''}`}>
              <span className="position">{index + 1}</span>
              <span className="name">{actor.name}</span>
              <label className="roll-label">
                Roll:
                <input
                  type="number"
                  className="roll-input"
                  value={actor.initiative_roll ?? ''}
                  onChange={(e) => handleInitiativeRollChange(actorId, e.target.value)}
                />
              </label>
              <div className="reorder-buttons">
                <button
                  type="button"
                  className="btn-arrow"
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${actor.name} up`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="btn-arrow"
                  onClick={() => handleMove(index, 1)}
                  disabled={index === orderedIds.length - 1}
                  aria-label={`Move ${actor.name} down`}
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default InitiativeTracker;
