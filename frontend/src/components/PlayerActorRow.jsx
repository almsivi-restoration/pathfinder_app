import React, { useEffect, useRef, useState } from 'react';
import { getSheetValue } from '../sheet';
import '../styles/PlayerActorRow.css';

// Losing at least this fraction of max HP in one update counts as a "big hit":
// those shake the bar on top of the flash + damage ghost every hit gets.
const BIG_HIT_FRACTION = 0.2;
// A touch longer than the ghost-drain animation so every effect plays out.
const FX_LINGER_MS = 1000;

function PlayerActorRow({ actor, position, isCurrent, rulesetConfig }) {
  const resource = rulesetConfig?.actor_sheet?.player_resource;
  const current = resource ? getSheetValue(actor.sheet, resource.current_key) : null;
  const maximum = resource ? getSheetValue(actor.sheet, resource.max_key) : null;
  const healthPercentage = maximum ? (current / maximum) * 100 : 0;

  const [hpFx, setHpFx] = useState(null);
  const prevHealthRef = useRef(null);
  const fxTimerRef = useRef(null);
  const fxNonceRef = useRef(0);

  // The player window learns about HP changes by polling the backend, so a
  // change between polls is the only "damage event" we ever see — size an
  // impact effect to it (fighting-game juice: shake + flash + ghost chunk).
  useEffect(() => {
    const cur = Number(current);
    const max = Number(maximum);
    if (!Number.isFinite(cur) || !Number.isFinite(max) || max <= 0) return;
    const prev = prevHealthRef.current;
    prevHealthRef.current = { cur, max };
    if (!prev || prev.cur === cur) return;
    const prevPct = Math.max(0, Math.min(100, (prev.cur / max) * 100));
    const drop = prev.cur - cur;
    const kind = drop <= 0 ? 'heal' : drop / max >= BIG_HIT_FRACTION ? 'hit-big' : 'hit';
    fxNonceRef.current += 1;
    setHpFx({ kind, prevPct, nonce: fxNonceRef.current });
    clearTimeout(fxTimerRef.current);
    fxTimerRef.current = setTimeout(() => setHpFx(null), FX_LINGER_MS);
  }, [current, maximum]);

  useEffect(() => () => clearTimeout(fxTimerRef.current), []);

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
      style={actor.color ? { borderLeft: `14px solid ${actor.color}` } : undefined}
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

        {resource && (
          <div className="health-bar-container">
            {/* Damage fx remount the bar (keyed by nonce) so the CSS animations
                restart on every hit; the ghost covers the fill's snap to the new
                width. Heals keep the steady key so the width transition animates
                the growth instead. */}
            <div
              key={hpFx && hpFx.kind !== 'heal' ? `fx-${hpFx.nonce}` : 'steady'}
              className={`health-bar-background${hpFx ? ` hp-fx-${hpFx.kind}` : ''}`}
            >
              <div
                className="health-bar-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, healthPercentage))}%`,
                  backgroundColor: barColor,
                }}
              />
              {hpFx && hpFx.kind !== 'heal' && (
                <div className="health-bar-ghost" style={{ width: `${hpFx.prevPct}%` }} />
              )}
              {actor.is_pc && (
                <span className="health-bar-value">{current}/{maximum}</span>
              )}
            </div>
          </div>
        )}

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
