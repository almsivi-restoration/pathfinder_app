import React, { useEffect } from 'react';
import { useStore } from '../store';
import PlayerActorRow from './PlayerActorRow';
import '../styles/PlayerView.css';

const POLL_INTERVAL_MS = 2000;

function PlayerView() {
  const actors = useStore((state) => state.actors);
  const initiativeOrder = useStore((state) => state.initiativeOrder);
  const currentRound = useStore((state) => state.currentRound);
  const currentTurnIndex = useStore((state) => state.currentTurnIndex);
  const isSceneActive = useStore((state) => state.isSceneActive);
  const fetchCurrentScene = useStore((state) => state.fetchCurrentScene);
  const rulesetConfig = useStore((state) => state.rulesetConfig);
  const fetchRulesetConfig = useStore((state) => state.fetchRulesetConfig);

  // This window is a separate renderer process with its own in-memory store, so it
  // has no knowledge of anything the GM window did. Poll the backend (the shared
  // source of truth) instead of relying on any state passed in at window-open time.
  useEffect(() => {
    fetchCurrentScene();
    fetchRulesetConfig();
    const intervalId = setInterval(fetchCurrentScene, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchCurrentScene, fetchRulesetConfig]);

  const getActorById = (actorId) => {
    return actors.find((a) => a.id === actorId);
  };

  const getCurrentActorId = () => {
    if (!initiativeOrder || initiativeOrder.length === 0) return null;
    return initiativeOrder[currentTurnIndex];
  };

  const displayOrder = initiativeOrder.length > 0 ? initiativeOrder : actors.map((a) => a.id);

  // During combat, lead the list with the active actor so players always see
  // whose turn it is at the top. Position badges keep the true initiative
  // numbers from the un-rotated order.
  const rotatedOrder =
    isSceneActive && initiativeOrder.length > 0 && currentTurnIndex > 0
      ? displayOrder.slice(currentTurnIndex).concat(displayOrder.slice(0, currentTurnIndex))
      : displayOrder;

  return (
    <div className="player-view">
      <header className="player-header">
        <h1>Combat Tracker</h1>
        {isSceneActive && (
          <div className="combat-info">
            <span className="round-badge">Round {currentRound}</span>
          </div>
        )}
      </header>

      <div className="player-content">
        {actors.length === 0 ? (
          <div className="waiting">Waiting for scene to start...</div>
        ) : (
          <div className="initiative-section">
            <h2>{isSceneActive ? 'Initiative Order' : 'Actors in Scene'}</h2>
            <div className="actor-list-player">
              {rotatedOrder.map((actorId) => {
                const actor = getActorById(actorId);
                if (!actor) return null;
                const isCurrent = isSceneActive && actorId === getCurrentActorId();
                return (
                  <PlayerActorRow
                    key={actorId}
                    actor={actor}
                    position={displayOrder.indexOf(actorId) + 1}
                    isCurrent={isCurrent}
                    rulesetConfig={rulesetConfig}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayerView;
