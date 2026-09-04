import React from 'react';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Presentational form fields shared by the create (ActorForm) and edit (ActorEditModal) flows. */
function ActorStatFields({ formData, onChange, onAbilityChange }) {
  return (
    <>
      <div className="form-row">
        <label className="field">
          <span className="field-label">Name</span>
          <input
            type="text"
            name="name"
            placeholder="Actor name"
            value={formData.name}
            onChange={onChange}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Player Name (if PC)</span>
          <input
            type="text"
            name="player_name"
            placeholder="Player name"
            value={formData.player_name}
            onChange={onChange}
          />
        </label>
      </div>

      <div className="form-row">
        <label className="checkbox-field">
          <input type="checkbox" name="is_pc" checked={formData.is_pc} onChange={onChange} />
          Player Character
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          <span className="field-label">Current HP</span>
          <input type="number" name="hp_current" value={formData.hp_current} onChange={onChange} required />
        </label>
        <label className="field">
          <span className="field-label">Max HP</span>
          <input type="number" name="hp_max" value={formData.hp_max} onChange={onChange} required />
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          <span className="field-label">Armor Class</span>
          <input type="number" name="ac" value={formData.ac} onChange={onChange} required />
        </label>
        <label className="field">
          <span className="field-label">Initiative Bonus</span>
          <input type="number" name="initiative_bonus" value={formData.initiative_bonus} onChange={onChange} />
        </label>
      </div>

      <div className="form-row">
        <label className="field">
          <span className="field-label">Speed</span>
          <input type="number" name="speed" value={formData.speed} onChange={onChange} />
        </label>
        <label className="field">
          <span className="field-label">Initiative Roll (physical die result)</span>
          <input
            type="number"
            name="initiative_roll"
            value={formData.initiative_roll ?? ''}
            onChange={onChange}
          />
        </label>
      </div>

      <div className="abilities-section">
        <h4>Abilities</h4>
        <div className="abilities-row">
          {ABILITIES.map((ability) => (
            <label key={ability} className="ability-input">
              <span className="field-label">{ability.toUpperCase()}</span>
              <input
                type="number"
                value={formData.abilities[ability]}
                onChange={(e) => onAbilityChange(ability, e.target.value)}
              />
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

export default ActorStatFields;
