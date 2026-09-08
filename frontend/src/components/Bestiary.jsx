import React, { useEffect, useState } from 'react';
import { useStore } from '../store';

const PAGE_SIZE = 50;

export function BestiarySearchPanel({ onSelect, selectLabel = 'View' }) {
  const bestiaryResults = useStore((state) => state.bestiaryResults);
  const searchBestiary = useStore((state) => state.searchBestiary);
  const [query, setQuery] = useState('');
  const [crMin, setCrMin] = useState('');
  const [crMax, setCrMax] = useState('');
  const [monsterType, setMonsterType] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const runSearch = async (pageIndex) => {
    const data = await searchBestiary({
      query,
      crMin,
      crMax,
      monsterType,
      limit: PAGE_SIZE,
      offset: pageIndex * PAGE_SIZE,
    });
    setTotal(data.total || 0);
    setPage(pageIndex);
  };

  useEffect(() => {
    searchBestiary({ query: '', crMin: '', crMax: '', monsterType: '' }).then((data) => {
      setTotal(data.total || 0);
      setPage(0);
    });
  }, [searchBestiary]);

  const handleSearch = async (event) => {
    event?.preventDefault();
    await runSearch(0);
  };

  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="bestiary-search-panel">
      <form className="bestiary-search-form" onSubmit={handleSearch}>
        <input
          type="search"
          placeholder="Search monsters by name or text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <input
          type="number"
          placeholder="CR min"
          value={crMin}
          onChange={(event) => setCrMin(event.target.value)}
          min="0"
          step="any"
        />
        <input
          type="number"
          placeholder="CR max"
          value={crMax}
          onChange={(event) => setCrMax(event.target.value)}
          min="0"
          step="any"
        />
        <input
          type="text"
          placeholder="Type (e.g. dragon)"
          value={monsterType}
          onChange={(event) => setMonsterType(event.target.value)}
        />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>
      <div className="bestiary-results">
        {bestiaryResults.map((result) => (
          <div className="bestiary-result-row" key={result.id}>
            <span className="bestiary-result-name">{result.name}</span>
            <span className="bestiary-result-meta">
              CR {result.cr_display || '—'} · {result.size} {result.type} {result.alignment}
            </span>
            <span className="bestiary-result-source">
              {result.source}{result.page ? ` p. ${result.page}` : ''}
            </span>
            <button
              type="button"
              className="btn-small btn-add"
              onClick={() => onSelect(result.id)}
            >
              {selectLabel}
            </button>
          </div>
        ))}
        {bestiaryResults.length === 0 && (
          <p className="bestiary-empty">No monsters match the search.</p>
        )}
      </div>
      {total > PAGE_SIZE && (
        <div className="bestiary-pager">
          <button
            type="button"
            className="btn-small"
            onClick={() => runSearch(page - 1)}
            disabled={page <= 0}
          >
            Previous
          </button>
          <span className="bestiary-pager-status">
            Page {page + 1} of {pageCount} · {total} monsters
          </span>
          <button
            type="button"
            className="btn-small"
            onClick={() => runSearch(page + 1)}
            disabled={page >= pageCount - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export function BestiaryEntryDetail({ entry, actions }) {
  if (!entry) return null;
  const list = (items) => (items || []).filter(Boolean);
  return (
    <article className="bestiary-entry">
      <header className="bestiary-entry-header">
        <h3>{entry.name}</h3>
        <p className="bestiary-entry-subtitle">
          CR {entry.cr_display || '—'} · XP {entry.xp ?? '—'} · {entry.size} {entry.type}
          {list(entry.subtypes).length ? ` (${entry.subtypes.join(', ')})` : ''} · {entry.alignment}
        </p>
        {actions}
      </header>
      {entry.desc_short && <p className="bestiary-entry-desc-short">{entry.desc_short}</p>}
      <dl className="bestiary-entry-stats">
        <dt>AC</dt>
        <dd>
          {entry.ac?.total ?? '—'}, touch {entry.ac?.touch ?? '—'}, flat-footed {entry.ac?.flat_footed ?? '—'}
        </dd>
        <dt>HP</dt>
        <dd>{entry.hp?.total ?? '—'} ({entry.hp?.hd || '—'})</dd>
        <dt>Saves</dt>
        <dd>
          Fort {formatSigned(entry.saves?.fort)}, Ref {formatSigned(entry.saves?.ref)}, Will {formatSigned(entry.saves?.will)}
          {entry.saves?.other ? `; ${entry.saves.other}` : ''}
        </dd>
        <dt>Initiative</dt><dd>{formatSigned(entry.initiative?.bonus)}</dd>
        <dt>Speed</dt><dd>{formatGroup(entry.speeds, ' ft.') || '—'}</dd>
        {entry.sr != null && <><dt>SR</dt><dd>{entry.sr}</dd></>}
        {(entry.damage_reduction || []).length > 0 && (
          <><dt>DR</dt><dd>{entry.damage_reduction.map((dr) => `${dr.amount}/${dr.weakness}`).join('; ')}</dd></>
        )}
        {entry.immunities && <><dt>Immune</dt><dd>{entry.immunities}</dd></>}
        {Object.keys(entry.resistances || {}).length > 0 && (
          <><dt>Resist</dt><dd>{formatGroup(entry.resistances)}</dd></>
        )}
        {list(entry.weaknesses).length > 0 && <><dt>Weaknesses</dt><dd>{entry.weaknesses.join(', ')}</dd></>}
      </dl>
      {list(entry.attacks).length > 0 && (
        <section>
          <h4>Attacks</h4>
          <ul>
            {entry.attacks.map((attack, index) => (
              <li key={index}><strong>{attack.category === 'ranged' ? 'Ranged' : 'Melee'}</strong> {attack.text || attack.name}</li>
            ))}
          </ul>
        </section>
      )}
      {list(entry.special_attacks).length > 0 && (
        <section><h4>Special Attacks</h4><p>{entry.special_attacks.join(', ')}</p></section>
      )}
      {list(entry.spell_like_abilities).length > 0 && (
        <section><h4>Spell-Like Abilities</h4><p>{entry.spell_like_abilities.join('; ')}</p></section>
      )}
      {list(entry.spells).length > 0 && (
        <section><h4>Spells</h4><p>{entry.spells.join('; ')}</p></section>
      )}
      {list(entry.skills).length > 0 && (
        <section>
          <h4>Skills</h4>
          <p>{entry.skills.map((skill) => `${skill.name} ${skill.total != null ? formatSigned(skill.total) : ''}${skill.note ? ` (${skill.note})` : ''}`.trim()).join(', ')}</p>
        </section>
      )}
      {list(entry.feats).length > 0 && <section><h4>Feats</h4><p>{entry.feats.join(', ')}</p></section>}
      {list(entry.special_abilities).length > 0 && (
        <section>
          <h4>Special Abilities</h4>
          {entry.special_abilities.map((ability, index) => <p key={index}>{ability}</p>)}
        </section>
      )}
      <section className="bestiary-entry-ecology">
        {entry.environment && <p><strong>Environment</strong> {entry.environment}</p>}
        {entry.organization && <p><strong>Organization</strong> {entry.organization}</p>}
        {entry.treasure && <p><strong>Treasure</strong> {entry.treasure}</p>}
      </section>
      {entry.desc_long && <section className="bestiary-entry-desc">{entry.desc_long.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>}
      {list(entry.sources).length > 0 && (
        <footer className="bestiary-entry-sources">
          Source: {entry.sources.map((source) => `${source.name}${source.page ? ` p. ${source.page}` : ''}`).join('; ')}
        </footer>
      )}
    </article>
  );
}

function formatSigned(value) {
  if (value == null) return '—';
  return value >= 0 ? `+${value}` : `${value}`;
}

function formatGroup(group, unit = '') {
  return Object.entries(group || {})
    .map(([key, value]) => (typeof value === 'number'
      ? `${key.replace(/_/g, ' ')} ${value}${unit}`
      : `${key.replace(/_/g, ' ')} ${value}${unit}`.trim()))
    .join(', ');
}
