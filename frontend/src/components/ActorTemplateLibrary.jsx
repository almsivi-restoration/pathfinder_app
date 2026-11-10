import React, { useEffect } from 'react';
import { useStore } from '../store';
import { getSheetValue } from '../sheet';
import ColorSwatch from './ColorSwatch';
import SymbolPicker from './SymbolPicker';
import '../styles/ActorTemplateLibrary.css';

function ActorTemplateLibrary() {
  const actorTemplates = useStore((state) => state.actorTemplates);
  const listActorTemplates = useStore((state) => state.listActorTemplates);
  const addActorFromTemplate = useStore((state) => state.addActorFromTemplate);
  const updateActorTemplate = useStore((state) => state.updateActorTemplate);
  const removeActorTemplate = useStore((state) => state.removeActorTemplate);
  const setSelectedTemplateId = useStore((state) => state.setSelectedTemplateId);
  const setViewingTemplateId = useStore((state) => state.setViewingTemplateId);
  const currentScene = useStore((state) => state.currentScene);
  const rulesetConfig = useStore((state) => state.rulesetConfig);
  const fetchRulesetConfig = useStore((state) => state.fetchRulesetConfig);

  useEffect(() => {
    listActorTemplates();
    // The summary column needs the ruleset's sheet definition; nothing else
    // on the dashboard fetches it, so the stats rendered blank.
    fetchRulesetConfig();
  }, [listActorTemplates, fetchRulesetConfig]);

  const handleAddToScene = async (templateId) => {
    await addActorFromTemplate(templateId);
  };

  const handleRemove = async (templateId, name) => {
    if (window.confirm(`Delete template "${name}"?`)) {
      await removeActorTemplate(templateId);
    }
  };

  const handleColorChange = async (template, color) => {
    await updateActorTemplate(template.id, { ...template, color });
  };

  const handleSymbolChange = async (template, symbol) => {
    await updateActorTemplate(template.id, { ...template, symbol });
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
        No campaign actors yet. Create one to reuse it in any scene for this campaign.
      </div>
    );
  }

  return (
    <div className="actor-template-library">
      {actorTemplates.map((template) => {
        // The hover title carries the full summary when a narrow column
        // ellipsizes the visible text.
        const summary = formatSummary(template);
        return (
        <div key={template.id} className="template-row">
          <span className="template-name">{template.name}</span>
          <span className="template-type">{template.is_pc ? 'PC' : 'NPC'}</span>
          <span className="template-stats" title={summary}>
            {summary}
          </span>
          <div className="template-actions">
            <ColorSwatch
              color={template.color}
              onChange={(color) => handleColorChange(template, color)}
              onClear={() => handleColorChange(template, null)}
              title={template.color ? `Marker color ${template.color}` : 'Assign a marker color (inherited by scene actors)'}
            />
            <SymbolPicker
              symbol={template.symbol}
              color={template.color}
              onChange={(symbol) => handleSymbolChange(template, symbol)}
              title={template.symbol ? undefined : 'Assign a marker symbol (inherited by scene actors)'}
            />
            <button className="btn-small" onClick={() => setViewingTemplateId(template.id)} title="View template details">
              View
            </button>
            {currentScene && (
              <button
                className="btn-small btn-add"
                onClick={() => handleAddToScene(template.id)}
                title="Add to current scene"
              >
                Add to Scene
              </button>
            )}
            <button className="btn-small btn-edit" onClick={() => setSelectedTemplateId(template.id)}>
              Edit
            </button>
            <button className="btn-small" onClick={() => handleRemove(template.id, template.name)}>
              Delete
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
}

export default ActorTemplateLibrary;
