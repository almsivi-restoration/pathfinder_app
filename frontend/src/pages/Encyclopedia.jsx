import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import '../styles/Encyclopedia.css';

function Encyclopedia({ onBack }) {
  const currentCampaign = useStore((state) => state.currentCampaign);
  const referenceSources = useStore((state) => state.referenceSources);
  const referenceDocuments = useStore((state) => state.referenceDocuments);
  const referenceResults = useStore((state) => state.referenceResults);
  const fetchCurrentReferences = useStore((state) => state.fetchCurrentReferences);
  const importCurrentReference = useStore((state) => state.importCurrentReference);
  const searchCurrentReferences = useStore((state) => state.searchCurrentReferences);
  const [query, setQuery] = useState('');
  const [indexingFilename, setIndexingFilename] = useState(null);

  useEffect(() => {
    fetchCurrentReferences();
  }, [fetchCurrentReferences]);

  const handleSearch = async (event) => {
    event.preventDefault();
    await searchCurrentReferences(query);
  };

  const handleImport = async (filename) => {
    setIndexingFilename(filename);
    await importCurrentReference(filename);
    setIndexingFilename(null);
  };

  const indexedFilenames = new Set(referenceDocuments.map((document) => document.filename));

  if (!currentCampaign) {
    return (
      <main className="encyclopedia">
        <header className="encyclopedia-header">
          <h1>Encyclopedia</h1>
          <button className="btn btn-secondary" onClick={onBack}>Back to Campaigns</button>
        </header>
        <section className="reference-sources">
          <p className="empty-reference-state">Load a campaign to access its ruleset references.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="encyclopedia">
      <header className="encyclopedia-header">
        <div>
          <h1>Encyclopedia</h1>
          <p>{currentCampaign?.name} · {currentCampaign?.ruleset}</p>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>Back to GM Dashboard</button>
      </header>

      <section className="reference-sources">
        <h2>Local References</h2>
        {referenceSources.length === 0 ? (
          <p className="empty-reference-state">No PDFs found for this ruleset.</p>
        ) : (
          <div className="reference-source-list">
            {referenceSources.map((filename) => (
              <div className="reference-source" key={filename}>
                <span>{filename}</span>
                <button
                  className="btn-small btn-add"
                  disabled={indexingFilename === filename}
                  onClick={() => handleImport(filename)}
                >
                  {indexingFilename === filename ? 'Indexing' : indexedFilenames.has(filename) ? 'Reindex' : 'Index'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="reference-search">
        <form onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Search active ruleset references"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="btn btn-primary" type="submit">Search</button>
        </form>
        <div className="reference-results">
          {referenceResults.map((result) => (
            <article className="reference-result" key={`${result.filename}-${result.page_number}-${result.excerpt}`}>
              <div className="reference-result-meta">{result.title} · Page {result.page_number}</div>
              <p>{result.excerpt}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default Encyclopedia;