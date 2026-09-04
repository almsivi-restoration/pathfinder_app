import React, { useState } from 'react';
import { useStore } from '../store';
import ActorStatFields from './ActorStatFields';
import '../styles/ActorForm.css';

function ActorForm({ onActorAdded }) {
  const ruleset = useStore((state) => state.ruleset);
  const addActor = useStore((state) => state.addActor);
  const saveActorTemplate = useStore((state) => state.saveActorTemplate);

  const emptyForm = {
    name: '',
    player_name: '',
    is_pc: true,
    hp_current: 10,
    hp_max: 10,
    ac: 10,
    initiative_bonus: 0,
    initiative_roll: null,
    speed: 30,
    abilities: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    },
  };

  const [formData, setFormData] = useState(emptyForm);

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

  const handleAbilityChange = (ability, value) => {
    setFormData({
      ...formData,
      abilities: {
        ...formData.abilities,
        [ability]: parseInt(value),
      },
    });
  };

  const buildActor = () => ({
    id: '',
    ...formData,
    ruleset,
    skills: {},
    saves: {},
    resistances: {},
    weapons: [],
    effects: [],
    notes: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addActor(buildActor());
    setFormData(emptyForm);
    onActorAdded();
  };

  const handleSaveTemplate = async () => {
    await saveActorTemplate(buildActor());
    setFormData(emptyForm);
    onActorAdded();
  };

  return (
    <form className="actor-form" onSubmit={handleSubmit}>
      <ActorStatFields formData={formData} onChange={handleChange} onAbilityChange={handleAbilityChange} />

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
