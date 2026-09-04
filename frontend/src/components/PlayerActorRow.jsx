import React from 'react';
import '../styles/PlayerActorRow.css';

function PlayerActorRow({ actor, position, isCurrent }) {
  const healthPercentage = (actor.hp_current / actor.hp_max) * 100;

  // Determine color gradient: green -> yellow -> red
  let barColor = '#4CAF50'; // green
  if (healthPercentage <= 50) {
    barColor = '#FF9800'; // yellow/orange
  }
  if (healthPercentage <= 25) {
    barColor = '#F44336'; // red
  }

  return (
    <div className={`player-actor-row ${isCurrent ? 'current-turn' : ''}`}>
      <div className="position-badge">{position}</div>
      <div className="actor-info">
        <div className="name-row">
          <span className="actor-name">{actor.name}</span>
          {actor.is_pc && <span className="pc-badge">PC</span>}
        </div>

        <div className="health-bar-container">
          {actor.is_pc ? (
            <div className="health-text">
              {actor.hp_current}/{actor.hp_max}
            </div>
          ) : (
            <>
              <div className="health-bar-background">
                <div
                  className="health-bar-fill"
                  style={{
                    width: `${Math.max(0, Math.min(100, healthPercentage))}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
            </>
          )}
        </div>

        {actor.effects && actor.effects.length > 0 && (
          <div className="effects-list">
            {actor.effects.map((effect, idx) => (
              <div key={idx} className="effect-badge">
                {effect.name}
                {effect.duration_rounds > 0 && (
                  <span className="duration">({effect.duration_rounds}r)</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayerActorRow;
