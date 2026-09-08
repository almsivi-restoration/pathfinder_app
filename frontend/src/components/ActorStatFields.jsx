import React from 'react';
import { getSheetValue } from '../sheet';

function CollectionField({ field, formData, onSheetChange }) {
  const items = getSheetValue(formData.sheet, field.key, []);
  const itemFields = field.item_fields || [];

  const updateItem = (index, itemField, event) => {
    const rawValue = itemField.type === 'checkbox' ? event.target.checked : event.target.value;
    const value = itemField.type === 'number' && rawValue !== '' ? Number(rawValue) : rawValue;
    const nextItems = items.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [itemField.key]: value } : item
    ));
    onSheetChange(field.key, nextItems);
  };

  const addItem = () => {
    const item = itemFields.reduce((nextItem, itemField) => (
      { ...nextItem, [itemField.key]: itemField.default ?? '' }
    ), {});
    onSheetChange(field.key, [...items, item]);
  };

  const removeItem = (index) => onSheetChange(field.key, items.filter((_, itemIndex) => itemIndex !== index));

  return (
    <div className="sheet-collection">
      <div className="sheet-collection-heading">
        <span className="field-label">{field.label}</span>
        <button type="button" className="btn-small btn-add" onClick={addItem}>Add</button>
      </div>
      {items.map((item, index) => (
        <div key={`${field.key}-${index}`} className="sheet-collection-item">
          {itemFields.map((itemField) => (
            <label key={itemField.key} className="sheet-field">
              <span className="field-label">{itemField.label}</span>
              <input
                type={itemField.type || 'text'}
                checked={itemField.type === 'checkbox' ? Boolean(item[itemField.key]) : undefined}
                value={itemField.type === 'checkbox' ? undefined : item[itemField.key] ?? itemField.default ?? ''}
                onChange={(event) => updateItem(index, itemField, event)}
              />
            </label>
          ))}
          <button type="button" className="btn-small" onClick={() => removeItem(index)}>Remove</button>
        </div>
      ))}
    </div>
  );
}

function ActorStatFields({
  formData,
  onChange,
  rulesetConfig,
  sheetDefinition,
  onSheetChange,
}) {
  const fields = (sheetDefinition || rulesetConfig?.actor_sheet)?.fields || [];
  const sections = fields.reduce((groups, field) => {
    const section = field.section || 'Details';
    groups[section] = [...(groups[section] || []), field];
    return groups;
  }, {});

  const handleSheetChange = (field, event) => {
    const rawValue = field.type === 'checkbox' ? event.target.checked : event.target.value;
    const value = field.type === 'number' && rawValue !== '' ? Number(rawValue) : rawValue;
    onSheetChange(field.key, value);
  };

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
          <span className="field-label">Initiative Roll (physical die result)</span>
          <input
            type="number"
            name="initiative_roll"
            value={formData.initiative_roll ?? ''}
            onChange={onChange}
          />
        </label>
      </div>

      {Object.entries(sections).map(([section, sectionFields]) => (
        <div key={section} className="sheet-section">
          <h4>{section}</h4>
          <div className="sheet-fields-grid">
            {sectionFields.map((field) => (
              field.type === 'collection' ? (
                <CollectionField key={field.key} field={field} formData={formData} onSheetChange={onSheetChange} />
              ) : (
                <label key={field.key} className={`sheet-field ${field.type === 'textarea' ? 'sheet-field-wide' : ''}`}>
                  <span className="field-label">{field.label}</span>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={getSheetValue(formData.sheet, field.key, field.default ?? '')}
                      onChange={(event) => handleSheetChange(field, event)}
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      checked={field.type === 'checkbox' ? Boolean(getSheetValue(formData.sheet, field.key)) : undefined}
                      value={field.type === 'checkbox' ? undefined : getSheetValue(formData.sheet, field.key, field.default ?? '')}
                      onChange={(event) => handleSheetChange(field, event)}
                    />
                  )}
                </label>
              )
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export default ActorStatFields;
