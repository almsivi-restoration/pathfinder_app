import React, { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useStore } from '../store';
import '../styles/Chronicle.css';

// Soft line breaks become <br> — a journal entry should read the way it was typed.
marked.setOptions({ breaks: true });

const renderMarkdown = (text) => ({
  __html: DOMPurify.sanitize(marked.parse(text || '')),
});

const MARKDOWN_GUIDE = [
  { syntax: '# Heading', note: 'large heading (## and ### are smaller)' },
  { syntax: '**bold**', note: 'bold text' },
  { syntax: '*italic*', note: 'italic text' },
  { syntax: '- item', note: 'bulleted list' },
  { syntax: '1. item', note: 'numbered list' },
  { syntax: '> text', note: 'block quote' },
  { syntax: '`code`', note: 'inline code' },
  { syntax: '[label](https://example.com)', note: 'link' },
  { syntax: '---', note: 'horizontal rule' },
];

const formatEntryDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

function Chronicle({ onClose }) {
  const chronicleEntries = useStore((state) => state.chronicleEntries);
  const fetchChronicle = useStore((state) => state.fetchChronicle);
  const addChronicleEntry = useStore((state) => state.addChronicleEntry);
  const updateChronicleEntry = useStore((state) => state.updateChronicleEntry);
  const deleteChronicleEntry = useStore((state) => state.deleteChronicleEntry);

  const [entryIndex, setEntryIndex] = useState(0);
  const [mode, setMode] = useState('read'); // 'read' | 'new' | 'edit'
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [rightPage, setRightPage] = useState('guide'); // 'guide' | 'preview'

  useEffect(() => {
    fetchChronicle();
  }, [fetchChronicle]);

  // Open the book on the latest entry, and keep the pointer in range after deletes.
  const didPositionOnLatest = useRef(false);
  useEffect(() => {
    if (!didPositionOnLatest.current && chronicleEntries.length > 0) {
      didPositionOnLatest.current = true;
      setEntryIndex(chronicleEntries.length - 1);
      return;
    }
    if (entryIndex > chronicleEntries.length - 1) {
      setEntryIndex(Math.max(0, chronicleEntries.length - 1));
    }
  }, [chronicleEntries, entryIndex]);

  const currentEntry = chronicleEntries[entryIndex] || null;
  const isWriting = mode !== 'read';
  const previewHtml = useMemo(() => renderMarkdown(draftBody), [draftBody]);

  const handleNew = () => {
    setDraftTitle('');
    setDraftBody('');
    setRightPage('preview');
    setMode('new');
  };

  const handleEdit = () => {
    if (!currentEntry) return;
    setDraftTitle(currentEntry.title);
    setDraftBody(currentEntry.body);
    setRightPage('preview');
    setMode('edit');
  };

  const handleSave = async () => {
    const title = draftTitle.trim();
    if (!title) return;
    if (mode === 'new') {
      const saved = await addChronicleEntry({ title, body: draftBody });
      if (!saved) return;
      setEntryIndex(chronicleEntries.length); // the store appends new entries at the end
    } else {
      const saved = await updateChronicleEntry(currentEntry.id, { title, body: draftBody });
      if (!saved) return;
    }
    setMode('read');
    setRightPage('guide');
  };

  const handleCancel = () => {
    setMode('read');
    setRightPage('guide');
  };

  const handleDelete = async () => {
    if (!currentEntry) return;
    if (!window.confirm(`Delete "${currentEntry.title}" from the chronicle?`)) return;
    await deleteChronicleEntry(currentEntry.id);
  };

  const handlePrev = () => setEntryIndex((index) => Math.max(0, index - 1));
  const handleNext = () => setEntryIndex((index) => Math.min(chronicleEntries.length - 1, index + 1));

  return (
    <div className="chronicle-backdrop" onClick={onClose}>
      <div className="chronicle-book" onClick={(event) => event.stopPropagation()}>
        <div className="chronicle-page chronicle-page-left">
          {isWriting ? (
            <div className="chronicle-editor">
              <input
                className="chronicle-title-input"
                type="text"
                placeholder="Entry title"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
              />
              <textarea
                className="chronicle-body-input"
                placeholder="Write the entry in markdown…"
                value={draftBody}
                onChange={(event) => setDraftBody(event.target.value)}
              />
            </div>
          ) : currentEntry ? (
            <article className="chronicle-entry">
              <h2 className="chronicle-entry-title">{currentEntry.title}</h2>
              <div className="chronicle-entry-date">{formatEntryDate(currentEntry.created_at)}</div>
              <div
                className="chronicle-markdown"
                dangerouslySetInnerHTML={renderMarkdown(currentEntry.body)}
              />
            </article>
          ) : (
            <div className="chronicle-empty">
              <p>The chronicle is empty.</p>
              <p>
                Record the campaign's deeds — session recaps, rumors heard, debts owed —
                and they will be kept here.
              </p>
            </div>
          )}
        </div>

        <div className="chronicle-page chronicle-page-right">
          {rightPage === 'preview' && isWriting ? (
            <div className="chronicle-preview">
              <div className="chronicle-page-label">Preview</div>
              <h2 className="chronicle-entry-title">{draftTitle.trim() || 'Untitled Entry'}</h2>
              <div className="chronicle-markdown" dangerouslySetInnerHTML={previewHtml} />
            </div>
          ) : (
            <div className="chronicle-guide">
              <div className="chronicle-page-label">Formatting Guide</div>
              <table>
                <tbody>
                  {MARKDOWN_GUIDE.map((row) => (
                    <tr key={row.syntax}>
                      <td><code>{row.syntax}</code></td>
                      <td>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="chronicle-footer">
          <div className="chronicle-footer-group">
            {isWriting ? (
              <>
                <button className="chronicle-btn" onClick={handleSave} disabled={!draftTitle.trim()}>
                  Save
                </button>
                <button className="chronicle-btn" onClick={handleCancel}>Cancel</button>
                <button
                  className="chronicle-btn"
                  onClick={() => setRightPage(rightPage === 'guide' ? 'preview' : 'guide')}
                >
                  {rightPage === 'guide' ? 'Preview' : 'Guide'}
                </button>
              </>
            ) : (
              <>
                <button className="chronicle-btn" onClick={handleNew}>New Entry</button>
                {currentEntry && <button className="chronicle-btn" onClick={handleEdit}>Edit</button>}
                {currentEntry && <button className="chronicle-btn" onClick={handleDelete}>Delete</button>}
              </>
            )}
          </div>

          <div className="chronicle-footer-group chronicle-nav">
            <button
              className="chronicle-btn"
              onClick={handlePrev}
              disabled={isWriting || entryIndex <= 0}
            >
              Prev
            </button>
            <span className="chronicle-pages">
              {chronicleEntries.length > 0 ? `${entryIndex + 1} / ${chronicleEntries.length}` : '0 / 0'}
            </span>
            <button
              className="chronicle-btn"
              onClick={handleNext}
              disabled={isWriting || entryIndex >= chronicleEntries.length - 1}
            >
              Next
            </button>
          </div>

          <div className="chronicle-footer-group">
            <button className="chronicle-btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chronicle;
