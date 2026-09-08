import React, { useEffect } from 'react';
import { useStore } from '../store';
import { getSheetValue } from '../sheet';
import '../styles/ActorViewModal.css';

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return String(value);
}

function SectionView({ section, fields, sheet }) {
  return (
    <div className="actor-view-section">
      <h4>{section}</h4>
      <dl className="actor-view-fields">
        {fields.map((field) => {
          const value = getSheetValue(sheet, field.key, field.default);
          if (field.type === 'collection') {
            const items = Array.isArray(value) ? value : [];
            if (items.length === 0) return null;
            return (
              <div key={field.key} className="actor-view-collection">
                <dt>{field.label}</dt>
                <dd>
                  <ul>
                    {items.map((item, index) => (
                      <li key={index}>
                        {(field.item_fields || [])
                          .map((itemField) => formatValue(item[itemField.key]))
                          .filter((text) => text !== '—')
                          .join(' · ')}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            );
          }
          const display = formatValue(value);
          if (display === '—') return null;
          return (
            <React.Fragment key={field.key}>
              <dt>{field.label}</dt>
              <dd className={field.type === 'textarea' ? 'actor-view-longtext' : ''}>{display}</dd>
            </React.Fragment>
          );
        })}
      </dl>
    </div>
  );
}

function ActorViewModal() {
  const actors = useStore((state) => state.actors);
  const viewingActorId = useStore((state) => state.viewingActorId);
  const setViewingActorId = useStore((state) => state.setViewingActorId);
  const rulesetConfig = useStore((state) => state.rulesetConfig);
  const fetchRulesetConfig = useStore((state) => state.fetchRulesetConfig);

  const actor = actors.find((a) => a.id === viewingActorId);

  useEffect(() => {
    if (viewingActorId) fetchRulesetConfig();
  }, [viewingActorId, fetchRulesetConfig]);

  if (!actor) return null;

  // Prefer the monster sheet for bestiary-derived NPCs (identified by the
  // bestiary provenance group on their sheet); fall back to the character sheet.
  const sheetDefinition = !actor.is_pc && actor.sheet?.bestiary && rulesetConfig?.monster_sheet
    ? rulesetConfig.monster_sheet
    : rulesetConfig?.actor_sheet;

  const fields = sheetDefinition?.fields || [];
  const sections = fields.reduce((groups, field) => {
    const section = field.section || 'Details';
    groups[section] = [...(groups[section] || []), field];
    return groups;
  }, {});

  const handleClose = () => setViewingActorId(null);

  return (
    <div className="actor-view-overlay" onClick={handleClose}>
      <div className="actor-view-modal" onClick={(e) => e.stopPropagation()}>
        <div className="actor-view-header">
          <h2>
            {actor.color && <span className="actor-color-dot" style={{ backgroundColor: actor.color }} />}
            {actor.name}
            <span className="actor-view-type">{actor.is_pc ? 'PC' : 'NPC'}</span>
          </h2>
          <button className="btn-close" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        {actor.effects && actor.effects.length > 0 && (
          <div className="actor-view-effects">
            {actor.effects.map((effect, index) => (
              <span key={index} className="effect-badge">
                {effect.name}
                {effect.duration_rounds > 0 && <span className="duration">({effect.duration_rounds}r)</span>}
              </span>
            ))}
          </div>
        )}

        <div className="actor-view-body">
          {Object.entries(sections).map(([section, sectionFields]) => (
            <SectionView key={section} section={section} fields={sectionFields} sheet={actor.sheet} />
          ))}
        </div>

        {actor.notes && !actor.notes.startsWith('{') && (
          <div className="actor-view-section">
            <h4>Notes</h4>
            <p className="actor-view-longtext">{actor.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActorViewModal;
