import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import ActorStatFields from './ActorStatFields';
import '../styles/ActorEditModal.css';

const emptyEffect = { name: '', duration_rounds: 1, description: '' };
const emptyWeapon = { name: '', damage_dice: '', damage_type: '', modifier: 0 };

function ActorEditModal() {
  const actors = useStore((state) => state.actors);
  const actorTemplates = useStore((state) => state.actorTemplates);
  const selectedActorId = useStore((state) => state.selectedActorId);
  const selectedTemplateId = useStore((state) => state.selectedTemplateId);
  const setSelectedActorId = useStore((state) => state.setSelectedActorId);
  const setSelectedTemplateId = useStore((state) => state.setSelectedTemplateId);
  const updateActor = useStore((state) => state.updateActor);
  const updateActorTemplate = useStore((state) => state.updateActorTemplate);
  const rulesetConfig = useStore((state) => state.rulesetConfig);
  const fetchRulesetConfig = useStore((state) => state.fetchRulesetConfig);

  const isTemplate = Boolean(selectedTemplateId);
  const actor = isTemplate
    ? actorTemplates.find((t) => t.id === selectedTemplateId)
    : actors.find((a) => a.id === selectedActorId);

  const [formData, setFormData] = useState(null);
  const [newEffect, setNewEffect] = useState(emptyEffect);
  const [newWeapon, setNewWeapon] = useState(emptyWeapon);

  // Re-seed local edit state whenever a different actor/template is opened.
  useEffect(() => {
    if (actor) {
      setFormData({ ...actor });
      setNewEffect(emptyEffect);
      setNewWeapon(emptyWeapon);
      fetchRulesetConfig(actor.ruleset);
    }
  }, [actor, fetchRulesetConfig]);

  if ((!selectedActorId && !selectedTemplateId) || !formData) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'initiative_roll') {
      setFormData({ ...formData, initiative_roll: value === '' ? null : parseInt(value, 10) });
      return;
    }
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleAbilityChange = (ability, value) => {
    setFormData({ ...formData, abilities: { ...formData.abilities, [ability]: parseInt(value) } });
  };

  const handleSkillChange = (skillName, value) => {
    setFormData({ ...formData, skills: { ...formData.skills, [skillName]: parseInt(value) || 0 } });
  };

  const handleSaveChange = (saveName, value) => {
    setFormData({ ...formData, saves: { ...formData.saves, [saveName]: parseInt(value) || 0 } });
  };

  const handleAddEffect = () => {
    if (!newEffect.name.trim()) return;
    setFormData({
      ...formData,
      effects: [...formData.effects, { ...newEffect, duration_rounds: parseInt(newEffect.duration_rounds) || 0 }],
    });
    setNewEffect(emptyEffect);
  };

  const handleRemoveEffect = (index) => {
    setFormData({ ...formData, effects: formData.effects.filter((_, i) => i !== index) });
  };

  const handleAddWeapon = () => {
    if (!newWeapon.name.trim()) return;
    setFormData({
      ...formData,
      weapons: [...formData.weapons, { ...newWeapon, modifier: parseInt(newWeapon.modifier) || 0 }],
    });
    setNewWeapon(emptyWeapon);
  };

  const handleRemoveWeapon = (index) => {
    setFormData({ ...formData, weapons: formData.weapons.filter((_, i) => i !== index) });
  };

  const handleClose = () => {
    setSelectedActorId(null);
    setSelectedTemplateId(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      hp_current: parseInt(formData.hp_current),
      hp_max: parseInt(formData.hp_max),
      ac: parseInt(formData.ac),
      initiative_bonus: parseInt(formData.initiative_bonus),
      speed: parseInt(formData.speed),
    };
    if (isTemplate) {
      await updateActorTemplate(actor.id, payload);
    } else {
      await updateActor(actor.id, payload);
    }
    handleClose();
  };

  return (
    <div className="actor-edit-overlay" onClick={handleClose}>
      <div className="actor-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="actor-edit-header">
          <h2>
            Edit {actor.name}
            {isTemplate ? ' (Template)' : ''}
          </h2>
          <button className="btn-close" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form className="actor-edit-form" onSubmit={handleSave}>
          <ActorStatFields
            formData={formData}
            onChange={handleChange}
            onAbilityChange={handleAbilityChange}
            rulesetConfig={rulesetConfig}
            onSkillChange={handleSkillChange}
            onSaveChange={handleSaveChange}
          />

          <div className="edit-section">
            <h4>Status Effects</h4>
            {formData.effects.length > 0 && (
              <div className="edit-list">
                {formData.effects.map((effect, index) => (
                  <div key={index} className="edit-list-row">
                    <span>
                      {effect.name} ({effect.duration_rounds} rounds)
                    </span>
                    <button type="button" className="btn-small" onClick={() => handleRemoveEffect(index)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="add-row">
              <input
                type="text"
                placeholder="Effect name (e.g. Poisoned)"
                value={newEffect.name}
                onChange={(e) => setNewEffect({ ...newEffect, name: e.target.value })}
              />
              <input
                type="number"
                placeholder="Duration (rounds)"
                value={newEffect.duration_rounds}
                onChange={(e) => setNewEffect({ ...newEffect, duration_rounds: e.target.value })}
              />
              <button type="button" className="btn btn-secondary" onClick={handleAddEffect}>
                Add Effect
              </button>
            </div>
          </div>

          <div className="edit-section">
            <h4>Weapons</h4>
            {formData.weapons.length > 0 && (
              <div className="edit-list">
                {formData.weapons.map((weapon, index) => (
                  <div key={index} className="edit-list-row">
                    <span>
                      {weapon.name} — {weapon.damage_dice} {weapon.damage_type} ({weapon.modifier >= 0 ? '+' : ''}
                      {weapon.modifier})
                    </span>
                    <button type="button" className="btn-small" onClick={() => handleRemoveWeapon(index)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="add-row">
              <input
                type="text"
                placeholder="Weapon name"
                value={newWeapon.name}
                onChange={(e) => setNewWeapon({ ...newWeapon, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="Damage dice (e.g. 1d8)"
                value={newWeapon.damage_dice}
                onChange={(e) => setNewWeapon({ ...newWeapon, damage_dice: e.target.value })}
              />
              <input
                type="text"
                placeholder="Damage type"
                value={newWeapon.damage_type}
                onChange={(e) => setNewWeapon({ ...newWeapon, damage_type: e.target.value })}
              />
              <input
                type="number"
                placeholder="Modifier"
                value={newWeapon.modifier}
                onChange={(e) => setNewWeapon({ ...newWeapon, modifier: e.target.value })}
              />
              <button type="button" className="btn btn-secondary" onClick={handleAddWeapon}>
                Add Weapon
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ActorEditModal;
