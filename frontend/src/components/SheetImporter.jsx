import React, { useState } from 'react';
import { useStore } from '../store';
import '../styles/SheetImporter.css';

// Editable review rows for the narrow v1 field set. The backend returns
// {fields, warnings}; we present each extracted value for GM confirmation.
const REVIEW_FIELDS = [
  { key: 'name', label: 'Character Name', type: 'text' },
  { key: 'abilities.str', label: 'STR', type: 'number' },
  { key: 'abilities.dex', label: 'DEX', type: 'number' },
  { key: 'abilities.con', label: 'CON', type: 'number' },
  { key: 'abilities.int', label: 'INT', type: 'number' },
  { key: 'abilities.wis', label: 'WIS', type: 'number' },
  { key: 'abilities.cha', label: 'CHA', type: 'number' },
  { key: 'hp.current', label: 'Current HP', type: 'number' },
  { key: 'hp.max', label: 'Max HP', type: 'number' },
  { key: 'defenses.ac', label: 'Armor Class', type: 'number' },
  { key: 'initiative.bonus', label: 'Initiative', type: 'number' },
];

// Shown only when the backend reports 503 without structured guidance (an
// older backend); current backends send the exact commands for this machine.
const FALLBACK_OCR_COMMANDS = [
  'python3 -m venv "$HOME/.config/Game Masters Workbench/ocr-venv"',
  '"$HOME/.config/Game Masters Workbench/ocr-venv/bin/pip" install "paddlepaddle==3.2.2" "paddleocr==3.3.0" "paddlex==3.3.0" "pymupdf==1.28.2" "Pillow>=10.0.0"',
];

function SheetImporter({ onClose }) {
  const importSheet = useStore((state) => state.importSheet);
  const addActor = useStore((state) => state.addActor);
  const saveActorTemplate = useStore((state) => state.saveActorTemplate);
  const currentScene = useStore((state) => state.currentScene);
  const operationError = useStore((state) => state.operationError);
  const clearOperationError = useStore((state) => state.clearOperationError);

  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);      // raw backend response
  const [values, setValues] = useState(null);    // editable field map
  const [ocrMissing, setOcrMissing] = useState(false); // backend lacks the OCR engine
  const [ocrDetail, setOcrDetail] = useState(null);    // structured install guidance from the 503
  const [destination, setDestination] = useState('scene'); // 'scene' | 'template'

  const handleFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    clearOperationError();
    setOcrMissing(false);
    setOcrDetail(null);
    setBusy(true);
    const result = await importSheet(file);
    setBusy(false);
    if (!result) return;
    if (result.ocrUnavailable) {
      setOcrDetail(result.ocrDetail && typeof result.ocrDetail === 'object' ? result.ocrDetail : null);
      setOcrMissing(true);
      return;
    }
    setDraft(result);
    // seed editable values from extracted fields
    const seed = {};
    result.fields.forEach((field) => {
      if (field.key !== 'saves') seed[field.key] = field.value ?? '';
    });
    // saves is a collection; pull totals into editable rows
    const saves = result.fields.find((f) => f.key === 'saves');
    (saves?.value || []).forEach((s) => {
      const k = { Fortitude: 'fort', Reflex: 'ref', Will: 'will' }[s.name];
      if (k) seed[`saves.${k}`] = s.total;
    });
    setValues(seed);
  };

  const setValue = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  const buildActor = () => {
    const num = (k) => (values[k] === '' || values[k] == null ? 0 : parseInt(values[k], 10) || 0);
    const sheet = {
      abilities: {
        str: num('abilities.str'), dex: num('abilities.dex'), con: num('abilities.con'),
        int: num('abilities.int'), wis: num('abilities.wis'), cha: num('abilities.cha'),
      },
      hp: { current: num('hp.current'), max: num('hp.max') },
      defenses: { ac: num('defenses.ac') },
      initiative: { bonus: num('initiative.bonus') },
      saves: [
        { name: 'Fortitude', ability: 'CON', total: num('saves.fort'), base: 0, ability_modifier: 0, magic: 0, misc: 0, temporary: 0 },
        { name: 'Reflex', ability: 'DEX', total: num('saves.ref'), base: 0, ability_modifier: 0, magic: 0, misc: 0, temporary: 0 },
        { name: 'Will', ability: 'WIS', total: num('saves.will'), base: 0, ability_modifier: 0, magic: 0, misc: 0, temporary: 0 },
      ],
    };
    return {
      id: '',
      name: (values.name || '').trim() || 'Imported Character',
      player_name: '',
      is_pc: true,
      initiative_roll: null,
      effects: [],
      notes: '',
      sheet,
    };
  };

  const handleConfirm = async () => {
    clearOperationError();
    const actor = buildActor();
    const result = destination === 'scene' ? await addActor(actor) : await saveActorTemplate(actor);
    if (!result) return;
    onClose();
  };

  const canAddToScene = Boolean(currentScene);

  return (
    <div className="sheet-importer-backdrop" onClick={onClose}>
      <div className="sheet-importer mw-panel" onClick={(event) => event.stopPropagation()}>
        <div className="mw-banner">Import Character Sheet</div>

        {!draft && (
          <div className="sheet-importer-upload">
            <p className="sheet-importer-hint">
              Upload a scanned Pathfinder 1e character sheet (PDF). The values are read by OCR and
              shown here for your review before anything is added.
            </p>
            <input type="file" accept="application/pdf" onChange={handleFile} disabled={busy} />
            {busy && <p className="sheet-importer-hint">Reading sheet…</p>}

            {ocrMissing && (
              <div className="sheet-importer-warnings">
                <strong>The OCR engine isn't installed on this computer.</strong>
                <p>
                  Sheet import uses PaddleOCR to read handwriting. It isn't bundled with the app
                  (it's large) and runs in its own Python environment, kept separate from the app
                  itself. To enable it, create that environment and install the engine:
                </p>
                {(ocrDetail?.commands || FALLBACK_OCR_COMMANDS).map((command) => (
                  <code key={command} className="sheet-importer-code">{command}</code>
                ))}
                <p>
                  The first import downloads the recognition models (~230&nbsp;MB). Restart the app
                  afterward, then try the import again.
                </p>
              </div>
            )}
          </div>
        )}

        {draft && values && (
          <div className="sheet-importer-review">
            {draft.warnings && draft.warnings.length > 0 && (
              <div className="sheet-importer-warnings">
                <strong>Could not read automatically:</strong>
                <ul>
                  {draft.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
                <span>Fill these in below before confirming.</span>
              </div>
            )}

            <div className="sheet-importer-grid">
              {REVIEW_FIELDS.map((field) => (
                <label key={field.key} className="sheet-importer-field">
                  {field.label}
                  <input
                    type={field.type}
                    value={values[field.key] ?? ''}
                    onChange={(event) => setValue(field.key, event.target.value)}
                  />
                </label>
              ))}
              {['fort', 'ref', 'will'].map((k) => (
                <label key={k} className="sheet-importer-field">
                  {k === 'fort' ? 'Fortitude' : k === 'ref' ? 'Reflex' : 'Will'}
                  <input
                    type="number"
                    value={values[`saves.${k}`] ?? ''}
                    onChange={(event) => setValue(`saves.${k}`, event.target.value)}
                  />
                </label>
              ))}
            </div>

            <div className="sheet-importer-destination">
              <label>
                <input
                  type="radio"
                  name="destination"
                  checked={destination === 'scene'}
                  onChange={() => setDestination('scene')}
                  disabled={!canAddToScene}
                />
                Add to current scene
              </label>
              <label>
                <input
                  type="radio"
                  name="destination"
                  checked={destination === 'template' || !canAddToScene}
                  onChange={() => setDestination('template')}
                />
                Save as campaign template
              </label>
            </div>

            {operationError && <div className="operation-message error">{operationError}</div>}

            <div className="sheet-importer-actions">
              <button type="button" className="btn btn-primary" onClick={handleConfirm}>
                {destination === 'scene' && canAddToScene ? 'Add to Scene' : 'Save as Template'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setDraft(null); setValues(null); }}>
                Re-scan
              </button>
            </div>
          </div>
        )}

        {operationError && !draft && <div className="operation-message error">{operationError}</div>}
      </div>
    </div>
  );
}

export default SheetImporter;
