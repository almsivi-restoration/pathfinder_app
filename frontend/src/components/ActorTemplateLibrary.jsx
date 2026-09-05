import React, { useEffect } from 'react';
import { useStore } from '../store';
import { getSheetValue } from '../sheet';
import '../styles/ActorTemplateLibrary.css';

function ActorTemplateLibrary() {
  const actorTemplates = useStore((state) => state.actorTemplates);
  const listActorTemplates = useStore((state) => state.listActorTemplates);
  const addActorFromTemplate = useStore((state) => state.addActorFromTemplate);
  const removeActorTemplate = useStore((state) => state.removeActorTemplate);
  const setSelectedTemplateId = useStore((state) => state.setSelectedTemplateId);
  const currentEncounter = useStore((state) => state.currentEncounter);
  const rulesetConfig = useStore((state) => state.rulesetConfig);

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

  const summaryFields = rulesetConfig?.actor_sheet?.summary || [];

  const formatSummary = (template) => summaryFields.map((field) => {
    const value = getSheetValue(template.sheet, field.value_key, '-');
    const displayValue = field.secondary_key
      ? `${value}/${getSheetValue(template.sheet, field.secondary_key, '-')}`
      : `${field.signed && Number(value) >= 0 ? '+' : ''}${value}`;
    return `${field.label} ${displayValue}`;
  }).join(' / ');

  if (actorTemplates.length === 0) {
    return (
      <div className="actor-template-library empty">
        No campaign actors yet. Create one to reuse it in any encounter for this campaign.
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
            {formatSummary(template)}
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
