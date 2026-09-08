import React from 'react';
import { getSheetValue } from '../sheet';
import '../styles/PlayerActorRow.css';

function PlayerActorRow({ actor, position, isCurrent, rulesetConfig }) {
  const resource = rulesetConfig?.actor_sheet?.player_resource;
  const current = resource ? getSheetValue(actor.sheet, resource.current_key) : null;
  const maximum = resource ? getSheetValue(actor.sheet, resource.max_key) : null;
  const healthPercentage = maximum ? (current / maximum) * 100 : 0;

  // Determine color gradient: green -> yellow -> red
  let barColor = '#4CAF50'; // green
  if (healthPercentage <= 50) {
    barColor = '#FF9800'; // yellow/orange
  }
  if (healthPercentage <= 25) {
    barColor = '#F44336'; // red
  }

  return (
    <div
      className={`player-actor-row ${isCurrent ? 'current-turn' : ''}`}
      style={actor.color ? { borderLeft: `8px solid ${actor.color}` } : undefined}
    >
      <div className="position-badge">{position}</div>
      <div className="actor-info">
        <div className="name-row">
          {actor.color && (
            <span className="actor-color-dot" style={{ backgroundColor: actor.color }} />
          )}
          <span className="actor-name">{actor.name}</span>
          {actor.is_pc && <span className="pc-badge">PC</span>}
        </div>

        {resource && <div className="health-bar-container">
          {actor.is_pc ? (
            <div className="health-text">
              {current}/{maximum}
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
        </div>}

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
