import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import '../styles/Harrowing.css';

function Harrowing({ onClose }) {
  const fetchHarrowingStatus = useStore((state) => state.fetchHarrowingStatus);
  const saveHarrowingConfig = useStore((state) => state.saveHarrowingConfig);
  const sendHarrowingChat = useStore((state) => state.sendHarrowingChat);
  const unloadHarrowing = useStore((state) => state.unloadHarrowing);

  const [status, setStatus] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [useReferences, setUseReferences] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  const refreshStatus = async () => {
    const data = await fetchHarrowingStatus();
    setStatus(data);
    if (data) {
      setBaseUrl(data.base_url || '');
      setModel(data.model || '');
      setShowSettings(!data.available);
    }
  };

  useEffect(() => {
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const handleSaveConfig = async () => {
    const saved = await saveHarrowingConfig(baseUrl, model);
    if (saved) await refreshStatus();
  };

  const handleUnload = async () => {
    await unloadHarrowing();
    await refreshStatus();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);
    setError(null);
    const res = await sendHarrowingChat({
      messages: nextMessages,
      useReferences,
    });
    if (res && res.error) {
      setError(res.error);
    } else if (res && res.content) {
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: res.content, grounded: res.grounded, references: res.references_used },
      ]);
    }
    setBusy(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="harrowing-backdrop" onClick={onClose}>
      <div className="harrowing mw-panel" onClick={(event) => event.stopPropagation()}>
        <div className="mw-banner">The Harrowing</div>

        <div className="harrowing-statusbar">
          {status && status.available ? (
            <span className="harrowing-status-ok">
              Connected — {status.model}
              {status.loaded
                ? ' (loaded in memory)'
                : ' (not loaded — first message takes a moment)'}
            </span>
          ) : (
            <span className="harrowing-status-down">No local model detected</span>
          )}
          <span className="harrowing-statusbar-actions">
            {status && status.available && status.loaded && (
              <button className="btn-small" onClick={handleUnload} title="Free the model from memory">
                Sleep
              </button>
            )}
            <button className="btn-small" onClick={() => setShowSettings((s) => !s)}>
              {showSettings ? 'Hide Settings' : 'Settings'}
            </button>
          </span>
        </div>

        {showSettings && (
          <div className="harrowing-settings">
            <p className="harrowing-hint">
              Run a local model server yourself — Ollama (<code>ollama serve</code>),
              LM Studio, or any OpenAI-compatible endpoint — and point the app at it.
              No model ships with Game Masters Workbench.
            </p>
            <label>
              Endpoint URL
              <input
                type="text"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="http://localhost:11434/v1"
              />
            </label>
            <label>
              Model
              <input
                type="text"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="llama3.1:8b"
              />
            </label>
            <div className="harrowing-settings-actions">
              <button className="btn btn-primary" onClick={handleSaveConfig}>
                Save &amp; Test
              </button>
            </div>
            {status && status.error && (
              <p className="harrowing-error">Could not reach the endpoint: {status.error}</p>
            )}
            {status && status.available && status.models && status.models.length > 0 && (
              <p className="harrowing-hint">
                Models on this server: {status.models.join(', ')}
              </p>
            )}
          </div>
        )}

        <div className="harrowing-log" ref={scrollRef}>
          {messages.length === 0 && (
            <p className="harrowing-empty">
              Ask for a story beat, an NPC's background, a plot hook — anything you
              want dealt from the deck.
            </p>
          )}
          {messages.map((message, index) => (
            <div key={index} className={`harrowing-msg harrowing-msg-${message.role}`}>
              <div className="harrowing-msg-role">
                {message.role === 'user' ? 'You' : 'The Harrowing'}
                {message.grounded && message.references && message.references.length > 0 && (
                  <span className="harrowing-grounded" title={message.references.join(', ')}>
                    {' '}· grounded in your books
                  </span>
                )}
              </div>
              <div className="harrowing-msg-body">{message.content}</div>
            </div>
          ))}
          {busy && <div className="harrowing-msg harrowing-msg-assistant"><div className="harrowing-msg-body">The cards are being dealt…</div></div>}
        </div>

        {error && <p className="harrowing-error">{error}</p>}

        <div className="harrowing-input-row">
          <textarea
            className="harrowing-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask The Harrowing… (Enter to send, Shift+Enter for a new line)"
            rows={2}
            disabled={!status || !status.available}
          />
          <div className="harrowing-input-side">
            <label className="harrowing-references-toggle">
              <input
                type="checkbox"
                checked={useReferences}
                onChange={(event) => setUseReferences(event.target.checked)}
              />
              Ground in my rulebooks
            </label>
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={!status || !status.available || busy || !input.trim()}
            >
              Send
            </button>
          </div>
        </div>

        <div className="harrowing-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default Harrowing;
