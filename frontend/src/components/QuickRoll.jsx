import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import { getSheetValue } from '../sheet';
import '../styles/QuickRoll.css';

const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100];
const ROLL_KINDS = [
  { key: 'skill', label: 'Skill' },
  { key: 'save', label: 'Save' },
  { key: 'ability', label: 'Ability Check' },
  { key: 'custom', label: 'Custom' },
];
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const HISTORY_LIMIT = 20;

// Sheet totals are numbers on character sheets but free text on monster sheets
// (e.g. "+12"), so pull the leading signed integer out of either shape.
function parseModifier(value) {
  const match = String(value ?? '').match(/[-+]?\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

// Both registered rulesets use the same ability-modifier curve: (score - 10) / 2,
// rounded down.
function abilityModifier(score) {
  const parsed = parseInt(score, 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.floor((parsed - 10) / 2);
}

function formatSigned(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function QuickRoll({ onClose }) {
  const actors = useStore((state) => state.actors);
  const rollDice = useStore((state) => state.rollDice);

  const [actorId, setActorId] = useState('');
  const [kind, setKind] = useState('skill');
  const [optionName, setOptionName] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customDieType, setCustomDieType] = useState(20);
  const [customModifier, setCustomModifier] = useState(0);
  const [history, setHistory] = useState([]);

  const actor = actors.find((entry) => entry.id === actorId) || null;

  const options = useMemo(() => {
    if (!actor || kind === 'custom') return [];
    if (kind === 'ability') {
      return ABILITIES.map((key) => ({
        name: key.toUpperCase(),
        modifier: abilityModifier(getSheetValue(actor.sheet, `abilities.${key}`)),
      }));
    }
    const entries = getSheetValue(actor.sheet, kind === 'skill' ? 'skills' : 'saves');
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((entry) => entry && entry.name)
      .map((entry) => ({ name: entry.name, modifier: parseModifier(entry.total) }));
  }, [actor, kind]);

  // Fall back to the first option so a freshly chosen actor is roll-ready.
  const selectedOption = options.find((entry) => entry.name === optionName) || options[0] || null;

  const rollSpec = kind === 'custom'
    ? {
        label: customLabel.trim() || (actor ? `${actor.name} — Custom` : 'Custom Roll'),
        dieType: customDieType,
        modifier: customModifier,
      }
    : actor && selectedOption
      ? { label: `${actor.name} — ${selectedOption.name}`, dieType: 20, modifier: selectedOption.modifier }
      : null;

  const handleRoll = async () => {
    if (!rollSpec) return;
    const result = await rollDice({ dieType: rollSpec.dieType, modifier: rollSpec.modifier });
    if (!result) return;
    setHistory((entries) => [
      { id: `${Date.now()}-${Math.random()}`, ...rollSpec, ...result },
      ...entries,
    ].slice(0, HISTORY_LIMIT));
  };

  const rollHint = kind !== 'custom' && !actor
    ? 'Select an actor, or switch to Custom.'
    : kind !== 'custom' && options.length === 0
      ? `No ${kind}s on this actor's sheet.`
      : null;

  return (
    <div className="quick-roll-backdrop" onClick={onClose}>
      <div className="quick-roll mw-panel" onClick={(event) => event.stopPropagation()}>
        <div className="mw-banner">Quick Roll</div>

        <div className="quick-roll-controls">
          <label>
            Actor
            <select value={actorId} onChange={(event) => setActorId(event.target.value)}>
              <option value="">None (custom)</option>
              {actors.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>

          <label>
            Roll
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value);
                setOptionName('');
              }}
            >
              {ROLL_KINDS.map((entry) => (
                <option key={entry.key} value={entry.key}>{entry.label}</option>
              ))}
            </select>
          </label>

          {kind !== 'custom' && actor && options.length > 0 && (
            <label>
              {ROLL_KINDS.find((entry) => entry.key === kind).label}
              <select
                value={selectedOption ? selectedOption.name : ''}
                onChange={(event) => setOptionName(event.target.value)}
              >
                {options.map((entry) => (
                  <option key={entry.name} value={entry.name}>
                    {entry.name} ({formatSigned(entry.modifier)})
                  </option>
                ))}
              </select>
            </label>
          )}

          {kind === 'custom' && (
            <>
              <label>
                Label
                <input
                  type="text"
                  value={customLabel}
                  placeholder="Custom Roll"
                  onChange={(event) => setCustomLabel(event.target.value)}
                />
              </label>
              <label>
                Die
                <select value={customDieType} onChange={(event) => setCustomDieType(Number(event.target.value))}>
                  {DIE_TYPES.map((sides) => (
                    <option key={sides} value={sides}>d{sides}</option>
                  ))}
                </select>
              </label>
              <label>
                Modifier
                <input
                  type="number"
                  value={customModifier}
                  onChange={(event) => setCustomModifier(parseInt(event.target.value, 10) || 0)}
                />
              </label>
            </>
          )}

          <button className="btn btn-primary" onClick={handleRoll} disabled={!rollSpec}>Roll</button>
        </div>

        {rollHint && <p className="quick-roll-hint">{rollHint}</p>}

        {history.length > 0 && (
          <ul className="quick-roll-history">
            {history.map((entry) => (
              <li key={entry.id}>
                <span className="quick-roll-entry-label">{entry.label}</span>
                <span className="quick-roll-entry-breakdown">
                  {`d${entry.dieType} · ${entry.die_roll} ${formatSigned(entry.modifier)}`}
                  {entry.bonus_dice_roll ? ` ${formatSigned(entry.bonus_dice_roll)}` : ''}
                  {' = '}
                  <strong className={
                    entry.dieType === 20 && entry.die_roll === 20
                      ? 'quick-roll-crit'
                      : entry.dieType === 20 && entry.die_roll === 1
                        ? 'quick-roll-fumble'
                        : ''
                  }>
                    {entry.total}
                  </strong>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="quick-roll-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default QuickRoll;
