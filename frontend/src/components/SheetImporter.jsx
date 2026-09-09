import React, { useState } from 'react';
import { useStore } from '../store';
import { defaultSheetForActor, setSheetValue } from '../sheet';
import '../styles/SheetImporter.css';

// Editable review rows. The backend returns {fields, warnings}; we present
// each extracted value for GM confirmation.
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
  { key: 'defenses.touch_ac', label: 'Touch AC', type: 'number' },
  { key: 'defenses.flat_footed_ac', label: 'Flat-Footed AC', type: 'number' },
  { key: 'initiative.bonus', label: 'Initiative', type: 'number' },
  { key: 'movement.base_speed', label: 'Speed', type: 'number' },
  { key: 'combat.base_attack_bonus', label: 'Base Attack Bonus', type: 'number' },
  { key: 'combat.cmb', label: 'CMB', type: 'number' },
  { key: 'combat.cmd', label: 'CMD', type: 'number' },
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
      if (field.key !== 'saves' && field.key !== 'skills') seed[field.key] = field.value ?? '';
    });
    // saves is a collection; pull totals into editable rows
    const saves = result.fields.find((f) => f.key === 'saves');
    (saves?.value || []).forEach((s) => {
      const k = { Fortitude: 'fort', Reflex: 'ref', Will: 'will' }[s.name];
      if (k) seed[`saves.${k}`] = s.total;
    });
    // skills likewise, keyed by skill id
    const skills = result.fields.find((f) => f.key === 'skills');
    (skills?.value || []).forEach((s) => {
      seed[`skills.${s.key}`] = s.total;
    });
    setValues(seed);
  };

  const setValue = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  const buildActor = () => {
    const num = (k) => (values[k] === '' || values[k] == null ? 0 : parseInt(values[k], 10) || 0);
    // Start from the ruleset's default sheet so every defined field exists,
    // then overlay the reviewed values onto it.
    const config = useStore.getState().rulesetConfig;
    let sheet = config?.actor_sheet ? defaultSheetForActor(config.actor_sheet) : {};
    REVIEW_FIELDS.filter((f) => f.key !== 'name' && values[f.key] !== undefined && values[f.key] !== '')
      .forEach((f) => { sheet = setSheetValue(sheet, f.key, num(f.key)); });
    // saves: overlay totals onto the default collection by name
    const saveTotals = { Fortitude: num('saves.fort'), Reflex: num('saves.ref'), Will: num('saves.will') };
    const baseSaves = Array.isArray(sheet.saves) ? sheet.saves : [];
    sheet = setSheetValue(sheet, 'saves', baseSaves.map((s) => (
      s.name in saveTotals ? { ...s, total: saveTotals[s.name] } : s
    )));
    // skills: overlay extracted totals onto the default collection by name
    const draftSkills = (draft.fields.find((f) => f.key === 'skills')?.value || []);
    if (draftSkills.length && Array.isArray(sheet.skills)) {
      const totals = {};
      draftSkills.forEach((s) => {
        const v = values[`skills.${s.key}`];
        totals[s.name] = v === '' || v == null ? s.total : (parseInt(v, 10) || 0);
      });
      sheet = setSheetValue(sheet, 'skills', sheet.skills.map((s) => (
        s.name in totals ? { ...s, total: totals[s.name] } : s
      )));
    }
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
    // A scene may legitimately be absent — templates only need a campaign.
    const effectiveDestination = destination === 'scene' && canAddToScene ? 'scene' : 'template';
    const result = effectiveDestination === 'scene' ? await addActor(actor) : await saveActorTemplate(actor);
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

            {(draft.fields.find((f) => f.key === 'skills')?.value || []).length > 0 && (
              <>
                <div className="sheet-importer-subhead">Skills (extracted)</div>
                <div className="sheet-importer-grid">
                  {(draft.fields.find((f) => f.key === 'skills')?.value || []).map((s) => (
                    <label key={s.key} className="sheet-importer-field">
                      {s.name} ({s.ability})
                      <input
                        type="number"
                        value={values[`skills.${s.key}`] ?? ''}
                        onChange={(event) => setValue(`skills.${s.key}`, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </>
            )}

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
