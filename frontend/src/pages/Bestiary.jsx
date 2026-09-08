import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { BestiaryEntryDetail, BestiarySearchPanel } from '../components/Bestiary';
import '../styles/Bestiary.css';

function Bestiary({ onBack }) {
  const currentCampaign = useStore((state) => state.currentCampaign);
  const bestiaryStatus = useStore((state) => state.bestiaryStatus);
  const fetchBestiaryStatus = useStore((state) => state.fetchBestiaryStatus);
  const importBestiary = useStore((state) => state.importBestiary);
  const fetchBestiaryEntry = useStore((state) => state.fetchBestiaryEntry);
  const fetchBestiaryEntryActor = useStore((state) => state.fetchBestiaryEntryActor);
  const addActor = useStore((state) => state.addActor);
  const saveActorTemplate = useStore((state) => state.saveActorTemplate);
  const currentScene = useStore((state) => state.currentScene);
  const operationError = useStore((state) => state.operationError);
  const clearOperationError = useStore((state) => state.clearOperationError);

  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    fetchBestiaryStatus();
  }, [fetchBestiaryStatus]);

  const handleImport = async () => {
    setImporting(true);
    clearOperationError();
    const result = await importBestiary();
    if (result) {
      const warningNote = result.warnings?.length ? ` (${result.warnings.length} parse warnings)` : '';
      setImportMessage(`Indexed ${result.entry_count} monsters from ${result.filename}${warningNote}.`);
    }
    setImporting(false);
  };

  const handleSelect = async (entryId) => {
    clearOperationError();
    setActionMessage('');
    const entry = await fetchBestiaryEntry(entryId);
    if (entry) setSelectedEntry(entry);
  };

  const buildActorFromEntry = async (entryId) => {
    const payload = await fetchBestiaryEntryActor(entryId);
    if (!payload) return null;
    return {
      id: '',
      initiative_roll: null,
      effects: [],
      ...payload,
    };
  };

  const handleCreateNpc = async (entryId) => {
    clearOperationError();
    const actor = await buildActorFromEntry(entryId);
    if (!actor) return;
    const created = await addActor(actor);
    if (created) setActionMessage(`Added ${created.name} to the current scene.`);
  };

  const handleSaveTemplate = async (entryId) => {
    clearOperationError();
    const actor = await buildActorFromEntry(entryId);
    if (!actor) return;
    const template = await saveActorTemplate(actor);
    if (template) setActionMessage(`Saved ${template.name} as a campaign template.`);
  };

  if (!currentCampaign) {
    return (
      <main className="bestiary-page">
        <header className="bestiary-header">
          <h1>Bestiary</h1>
          <button className="btn btn-secondary" onClick={onBack}>Back to Campaigns</button>
        </header>
        <p className="bestiary-empty">Load a campaign to access its ruleset bestiary.</p>
      </main>
    );
  }

  return (
    <main className="bestiary-page">
      <header className="bestiary-header">
        <div>
          <h1>Bestiary</h1>
          <p>{currentCampaign?.name} · {currentCampaign?.ruleset}</p>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>Back to GM Dashboard</button>
      </header>

      <section className="bestiary-source">
        <h2>Local Bestiary</h2>
        {(operationError || importMessage || actionMessage) && (
          <div className={`operation-message ${operationError ? 'error' : 'success'}`}>
            {operationError || importMessage || actionMessage}
          </div>
        )}
        {!bestiaryStatus?.source_present ? (
          <p className="bestiary-empty">
            No bestiary found for this ruleset. Drop a file named
            {' '}<strong>{bestiaryStatus?.filename || 'bestiary.csv'}</strong> into the ruleset
            sources directory, then import it here.
          </p>
        ) : (
          <div className="bestiary-source-row">
            <span>
              {bestiaryStatus.filename}
              {bestiaryStatus.imported
                ? ` — ${bestiaryStatus.entry_count} monsters indexed${bestiaryStatus.stale ? ' (file changed since import)' : ''}`
                : ' — not yet imported'}
            </span>
            <button className="btn-small btn-add" disabled={importing} onClick={handleImport}>
              {importing ? 'Importing' : bestiaryStatus.imported ? 'Reimport' : 'Import'}
            </button>
          </div>
        )}
      </section>

      {bestiaryStatus?.imported && (
        <div className="bestiary-body">
          <BestiarySearchPanel onSelect={handleSelect} />
          <section className="bestiary-detail">
            <BestiaryEntryDetail
              entry={selectedEntry}
              actions={selectedEntry && (
                <div className="bestiary-entry-actions">
                  <button
                    className="btn btn-primary"
                    disabled={!currentScene}
                    title={currentScene ? 'Create an NPC in the current scene' : 'Open a scene first'}
                    onClick={() => handleCreateNpc(selectedEntry.id)}
                  >
                    Create NPC
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleSaveTemplate(selectedEntry.id)}
                  >
                    Save as Campaign Template
                  </button>
                </div>
              )}
            />
            {!selectedEntry && <p className="bestiary-empty">Select a monster to view its entry.</p>}
          </section>
        </div>
      )}
    </main>
  );
}

export default Bestiary;
