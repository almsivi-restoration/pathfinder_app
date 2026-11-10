import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import MatSheet, { MatSwatch } from './MatSheet';
import { MAT_DEFAULT_SIZE, clampMatSide, matLegend, planMat } from '../matGuide';
import { cellLabel } from '../venueGeometry';
import '../styles/MatGuide.css';

const ORIENTATIONS = [
  { id: 'auto', label: 'Best fit' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' },
];
const VIEWS = [
  { id: 'mat', label: 'Whole mat' },
  { id: 'closeup', label: 'Close-up' },
];

const squares = (count) => `${count} square${count === 1 ? '' : 's'}`;

// The Mat Guide: how to copy a venue onto the physical table mat, square by square.
// Portaled to <body> so it stacks above the editor and so print CSS can isolate it.
export default function MatGuide({ venue, onClose }) {
  const [orientation, setOrientation] = useState('auto');
  const [size, setSize] = useState(MAT_DEFAULT_SIZE);
  const [sizeDraft, setSizeDraft] = useState({
    columns: String(MAT_DEFAULT_SIZE.columns),
    rows: String(MAT_DEFAULT_SIZE.rows),
  });
  const [sectionIndex, setSectionIndex] = useState(0);
  const [view, setView] = useState('mat');

  const plan = useMemo(() => planMat(venue, size, orientation), [venue, size, orientation]);
  const legend = useMemo(() => matLegend(venue), [venue]);
  const section = plan.sections[Math.min(sectionIndex, plan.sections.length - 1)];
  const multiple = plan.sections.length > 1;
  const across = Math.max(...plan.sections.map((entry) => entry.column)) + 1;

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.classList.add('mat-guide-open');
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('mat-guide-open');
    };
  }, [onClose]);

  // Typed sizes apply on Enter or blur, so a half-typed "3" never re-plans a 4-square mat.
  const applySize = () => {
    const next = {
      columns: clampMatSide(sizeDraft.columns, size.columns),
      rows: clampMatSide(sizeDraft.rows, size.rows),
    };
    setSizeDraft({ columns: String(next.columns), rows: String(next.rows) });
    if (next.columns !== size.columns || next.rows !== size.rows) {
      setSize(next);
      setSectionIndex(0);
    }
  };
  const onSizeKey = (event) => {
    if (event.key === 'Enter') applySize();
  };

  const chooseOrientation = (id) => {
    setOrientation(id);
    setSectionIndex(0);
  };

  return createPortal(
    <div className="mat-guide-overlay" onClick={onClose}>
      {/* Printing follows the plan: a wide mat prints on a sideways page. Only orientation is set, so the paper size stays the user's. */}
      <style>
        {`@media print { @page { size: ${plan.orientation}; } .mat-guide-sheet { height: ${plan.orientation === 'portrait' ? '9in' : '6.4in'}; } }`}
      </style>
      <div
        className="mat-guide"
        role="dialog"
        aria-modal="true"
        aria-label={`Mat Guide: ${venue.name || 'Untitled venue'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mat-guide-header">
          <h2>
            Mat Guide
            <span className="mat-guide-venue-name">{venue.name || 'Untitled venue'}</span>
          </h2>
          <div className="mat-guide-actions">
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              Print
            </button>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </header>

        <div className="mat-guide-body">
          <aside className="mat-guide-side">
            <div className="mat-guide-controls">
              <div className="mat-guide-field">
                <span>Mat</span>
                <div className="mat-guide-segments" role="group" aria-label="Mat orientation">
                  {ORIENTATIONS.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`btn mat-guide-segment${orientation === entry.id ? ' active' : ''}`}
                      aria-pressed={orientation === entry.id}
                      onClick={() => chooseOrientation(entry.id)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mat-guide-field">
                <span>View</span>
                <div className="mat-guide-segments" role="group" aria-label="Sheet view">
                  {VIEWS.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`btn mat-guide-segment${view === entry.id ? ' active' : ''}`}
                      aria-pressed={view === entry.id}
                      onClick={() => setView(entry.id)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mat-guide-field">
                <span>Mat size (squares)</span>
                <div className="mat-guide-size-row">
                  <input
                    type="number"
                    min="4"
                    max="100"
                    aria-label="Mat squares, one side"
                    value={sizeDraft.columns}
                    onChange={(event) => setSizeDraft({ ...sizeDraft, columns: event.target.value })}
                    onBlur={applySize}
                    onKeyDown={onSizeKey}
                  />
                  <span>×</span>
                  <input
                    type="number"
                    min="4"
                    max="100"
                    aria-label="Mat squares, other side"
                    value={sizeDraft.rows}
                    onChange={(event) => setSizeDraft({ ...sizeDraft, rows: event.target.value })}
                    onBlur={applySize}
                    onKeyDown={onSizeKey}
                  />
                </div>
              </div>
              {multiple && (
                <div className="mat-guide-field">
                  <span>Too big for one mat: draw it a section at a time</span>
                  <div
                    className="mat-guide-sections"
                    role="group"
                    aria-label="Sections"
                    style={{ gridTemplateColumns: `repeat(${across}, 36px)` }}
                  >
                    {plan.sections.map((entry) => (
                      <button
                        key={entry.index}
                        type="button"
                        className={`btn mat-guide-segment${entry.index === section.index ? ' active' : ''}`}
                        aria-pressed={entry.index === section.index}
                        aria-label={`Section ${entry.index + 1}`}
                        onClick={() => setSectionIndex(entry.index)}
                      >
                        {entry.index + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <section className="mat-guide-steps" aria-label="How to draw it">
              {multiple && (
                <h3>Section {section.index + 1} of {plan.sections.length}</h3>
              )}
              {plan.empty ? (
                <p>This venue is empty. Paint some rooms first.</p>
              ) : (
                <ol>
                  <li>
                    {plan.columns === plan.rows ? (
                      <>Lay the mat out: <strong>{plan.columns} squares</strong> each way.</>
                    ) : (
                      <>
                        Turn the mat <strong>{plan.orientation === 'portrait' ? 'tall' : 'wide'}</strong>:
                        {' '}{plan.columns} squares across, {plan.rows} down.
                      </>
                    )}
                  </li>
                  <li>
                    Count <strong>{squares(section.left)}</strong> in from the left edge and
                    {' '}<strong>{squares(section.top)}</strong> down from the top. The map's top-left
                    corner is square <strong>{cellLabel(section.left, section.top)}</strong>.
                  </li>
                  <li>
                    The map covers <strong>{section.width} × {section.height}</strong> squares
                    {multiple && ` (venue squares ${cellLabel(section.x0, section.y0)} to ${cellLabel(section.x1 - 1, section.y1 - 1)})`}.
                  </li>
                  <li>Draw the walls and doors in black, then the marks in the key. Everything else stays blank.</li>
                </ol>
              )}
              {multiple && <p className="mat-guide-note">Dashed blue edges continue in the next section.</p>}
            </section>

            <section className="mat-guide-key" aria-label="Key">
              <h3>Key</h3>
              {legend.length ? (
                <ul>
                  {legend.map((entry) => (
                    <li key={entry.key} data-key={entry.key}>
                      <MatSwatch entry={entry} />
                      <span className="mat-guide-key-text">
                        <span className="mat-guide-key-label">{entry.label}</span>
                        <span className="mat-guide-key-hint">{entry.hint}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mat-guide-note">Nothing to draw yet.</p>
              )}
            </section>
          </aside>

          <div className="mat-guide-sheet">
            <MatSheet venue={venue} plan={plan} section={section} view={view} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
