import React, { useEffect } from 'react';
import { useStore } from '../store';
import '../styles/ActorTemplateLibrary.css';

function ActorTemplateLibrary() {
  const actorTemplates = useStore((state) => state.actorTemplates);
  const listActorTemplates = useStore((state) => state.listActorTemplates);
  const addActorFromTemplate = useStore((state) => state.addActorFromTemplate);
  const removeActorTemplate = useStore((state) => state.removeActorTemplate);
  const setSelectedTemplateId = useStore((state) => state.setSelectedTemplateId);
  const currentEncounter = useStore((state) => state.currentEncounter);

  useEffect(() => {
    listActorTemplates();
  }, [listActorTemplates]);

  const handleAddToEncounter = async (templateId) => {
    await addActorFromTemplate(templateId);
  };

  const handleRemove = async (templateId, name) => {
    if (window.confirm(`Delete template "${name}"?`)) {
      await removeActorTemplate(templateId);
    }
  };

  if (actorTemplates.length === 0) {
    return (
      <div className="actor-template-library empty">
        No saved actor templates yet. Use "Save as Campaign Template" on the add-actor form.
      </div>
    );
  }

  return (
    <div className="actor-template-library">
      {actorTemplates.map((template) => (
        <div key={template.id} className="template-row">
          <span className="template-name">{template.name}</span>
          <span className="template-type">{template.is_pc ? 'PC' : 'NPC'}</span>
          <span className="template-stats">
            HP {template.hp_max} / AC {template.ac}
          </span>
          <div className="template-actions">
            <button
              className="btn-small btn-add"
              onClick={() => handleAddToEncounter(template.id)}
              disabled={!currentEncounter}
              title={!currentEncounter ? 'Create an encounter first' : 'Add to current encounter'}
            >
              Add to Encounter
            </button>
            <button className="btn-small btn-edit" onClick={() => setSelectedTemplateId(template.id)}>
              Edit
            </button>
            <button className="btn-small" onClick={() => handleRemove(template.id, template.name)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ActorTemplateLibrary;
