import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import ActorStatFields from './ActorStatFields';
import { setSheetValue } from '../sheet';
import '../styles/ActorEditModal.css';

const emptyEffect = { name: '', duration_rounds: 1, description: '' };

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
  const operationError = useStore((state) => state.operationError);
  const clearOperationError = useStore((state) => state.clearOperationError);

  const isTemplate = Boolean(selectedTemplateId);
  const actor = isTemplate
    ? actorTemplates.find((t) => t.id === selectedTemplateId)
    : actors.find((a) => a.id === selectedActorId);

  const [formData, setFormData] = useState(null);
  const [newEffect, setNewEffect] = useState(emptyEffect);

  // Re-seed local edit state whenever a different actor/template is opened.
  useEffect(() => {
    if (actor) {
      setFormData({ ...actor });
      setNewEffect(emptyEffect);
      fetchRulesetConfig();
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

  const handleSheetChange = (path, value) => {
    setFormData({ ...formData, sheet: setSheetValue(formData.sheet, path, value) });
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

  const handleClose = () => {
    setSelectedActorId(null);
    setSelectedTemplateId(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = formData;
    clearOperationError();
    const result = isTemplate
      ? await updateActorTemplate(actor.id, payload)
      : await updateActor(actor.id, payload);
    if (!result) return;
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
            rulesetConfig={rulesetConfig}
            onSheetChange={handleSheetChange}
          />
          {operationError && <div className="operation-message error">{operationError}</div>}

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
