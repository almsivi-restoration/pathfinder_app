import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import ActorStatFields from './ActorStatFields';
import { createDefaultSheet, setSheetValue } from '../sheet';
import '../styles/ActorForm.css';

function ActorForm({ onActorAdded }) {
  const rulesetConfig = useStore((state) => state.rulesetConfig);
  const fetchRulesetConfig = useStore((state) => state.fetchRulesetConfig);
  const addActor = useStore((state) => state.addActor);
  const saveActorTemplate = useStore((state) => state.saveActorTemplate);

  const emptyForm = {
    name: '',
    player_name: '',
    is_pc: true,
    initiative_roll: null,
    sheet: {},
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    const loadSheetDefinition = async () => {
      const config = await fetchRulesetConfig();
      if (config?.actor_sheet) {
        setFormData((current) => ({ ...current, sheet: createDefaultSheet(config.actor_sheet) }));
      }
    };
    loadSheetDefinition();
  }, [fetchRulesetConfig]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'initiative_roll') {
      setFormData({ ...formData, initiative_roll: value === '' ? null : parseInt(value, 10) });
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

  const buildActor = () => ({
    id: '',
    ...formData,
    effects: [],
    notes: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addActor(buildActor());
    setFormData({ ...emptyForm, sheet: createDefaultSheet(rulesetConfig?.actor_sheet) });
    onActorAdded();
  };

  const handleSaveTemplate = async () => {
    await saveActorTemplate(buildActor());
    setFormData({ ...emptyForm, sheet: createDefaultSheet(rulesetConfig?.actor_sheet) });
    onActorAdded();
  };

  return (
    <form className="actor-form" onSubmit={handleSubmit}>
      <ActorStatFields
        formData={formData}
        onChange={handleChange}
        rulesetConfig={rulesetConfig}
        onSheetChange={handleSheetChange}
      />

      <div className="form-actions">
        <button type="submit" className="btn btn-primary">
          Add to Encounter
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleSaveTemplate}>
          Save as Campaign Template
        </button>
      </div>
    </form>
  );
}

export default ActorForm;
