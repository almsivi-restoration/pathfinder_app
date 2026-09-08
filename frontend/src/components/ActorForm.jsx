import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import ActorStatFields from './ActorStatFields';
import { BestiarySearchPanel } from './Bestiary';
import { defaultSheetForActor, setSheetValue } from '../sheet';
import '../styles/ActorForm.css';
import '../styles/Bestiary.css';

function ActorForm({ onActorAdded, allowSceneAdd = true }) {
  const rulesetConfig = useStore((state) => state.rulesetConfig);
  const fetchRulesetConfig = useStore((state) => state.fetchRulesetConfig);
  const addActor = useStore((state) => state.addActor);
  const saveActorTemplate = useStore((state) => state.saveActorTemplate);
  const fetchBestiaryEntryActor = useStore((state) => state.fetchBestiaryEntryActor);
  const bestiaryStatus = useStore((state) => state.bestiaryStatus);
  const fetchBestiaryStatus = useStore((state) => state.fetchBestiaryStatus);
  const operationError = useStore((state) => state.operationError);
  const clearOperationError = useStore((state) => state.clearOperationError);

  const emptyForm = {
    name: '',
    player_name: '',
    is_pc: true,
    initiative_roll: null,
    sheet: {},
  };

  const [formData, setFormData] = useState(emptyForm);
  const [showBestiaryPicker, setShowBestiaryPicker] = useState(false);

  const sheetDefinition = !formData.is_pc && rulesetConfig?.monster_sheet
    ? rulesetConfig.monster_sheet
    : rulesetConfig?.actor_sheet;

  useEffect(() => {
    const loadSheetDefinition = async () => {
      const config = await fetchRulesetConfig();
      if (config?.actor_sheet) {
        setFormData((current) => ({ ...current, sheet: defaultSheetForActor(config.actor_sheet) }));
      }
    };
    loadSheetDefinition();
  }, [fetchRulesetConfig]);

  useEffect(() => {
    fetchBestiaryStatus();
  }, [fetchBestiaryStatus]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'initiative_roll') {
      setFormData({ ...formData, initiative_roll: value === '' ? null : parseInt(value, 10) });
      return;
    }
    if (name === 'is_pc' && rulesetConfig) {
      // Switching PC/NPC switches the sheet definition; rebuild defaults so
      // fields from the other definition don't linger.
      const nextDefinition = !checked && rulesetConfig.monster_sheet
        ? rulesetConfig.monster_sheet
        : rulesetConfig.actor_sheet;
      setFormData({
        ...formData,
        is_pc: checked,
        sheet: defaultSheetForActor(nextDefinition),
      });
      return;
    }
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSheetChange = (path, value) => {
    setFormData({ ...formData, sheet: setSheetValue(formData.sheet, path, value) });
  };

  const handleApplyBestiaryEntry = async (entryId) => {
    clearOperationError();
    const payload = await fetchBestiaryEntryActor(entryId);
    if (!payload) return;
    setFormData((current) => ({
      ...current,
      name: payload.name || current.name,
      is_pc: false,
      sheet: payload.sheet,
    }));
    setShowBestiaryPicker(false);
  };

  const resetForm = () => setFormData({ ...emptyForm, sheet: defaultSheetForActor(sheetDefinition) });

  const buildActor = () => ({
    id: '',
    ...formData,
    effects: [],
    notes: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearOperationError();
    const actor = await addActor(buildActor());
    if (!actor) return;
    resetForm();
    onActorAdded();
  };

  const handleSaveTemplate = async () => {
    clearOperationError();
    const template = await saveActorTemplate(buildActor());
    if (!template) return;
    resetForm();
    onActorAdded();
  };

  const bestiaryAvailable = Boolean(bestiaryStatus?.imported && rulesetConfig?.monster_sheet);

  return (
    <div className="actor-form-overlay">
      <form className="actor-form" onSubmit={handleSubmit}>
        <div className="actor-form-header">
          <h2>New Actor</h2>
          <button type="button" className="btn-small" onClick={onActorAdded}>Close</button>
        </div>
        {bestiaryAvailable && (
          <div className="actor-form-bestiary">
            <button type="button" className="btn btn-secondary" onClick={() => setShowBestiaryPicker(true)}>
              Apply from Bestiary…
            </button>
          </div>
        )}
        <ActorStatFields
          formData={formData}
          onChange={handleChange}
          rulesetConfig={rulesetConfig}
          sheetDefinition={sheetDefinition}
          onSheetChange={handleSheetChange}
        />
        {operationError && <div className="operation-message error">{operationError}</div>}

        <div className="form-actions actor-form-actions">
          {allowSceneAdd && (
            <button type="submit" className="btn btn-primary">
              Add to Scene
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={handleSaveTemplate}>
            Save as Campaign Template
          </button>
        </div>
      </form>
      {showBestiaryPicker && (
        <div className="bestiary-picker-overlay">
          <div className="bestiary-picker">
            <div className="bestiary-picker-header">
              <h3>Apply from Bestiary</h3>
              <button type="button" className="btn-small" onClick={() => setShowBestiaryPicker(false)}>Close</button>
            </div>
            <BestiarySearchPanel onSelect={handleApplyBestiaryEntry} selectLabel="Apply" />
          </div>
        </div>
      )}
    </div>
  );
}

export default ActorForm;
