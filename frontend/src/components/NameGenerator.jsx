import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import '../styles/NameGenerator.css';

const CATEGORY_LABELS = {
  actor: 'Actor',
  place: 'Place',
  item: 'Item',
  faction: 'Faction',
  event: 'Event',
};

function NameGenerator({ onClose }) {
  const fetchNameCategories = useStore((state) => state.fetchNameCategories);
  const generateNames = useStore((state) => state.generateNames);

  const [categories, setCategories] = useState([]);
  const [placeLevels, setPlaceLevels] = useState([]);
  const [races, setRaces] = useState([]);
  const [category, setCategory] = useState('actor');
  const [race, setRace] = useState('');
  const [placeLevel, setPlaceLevel] = useState('city');
  const [count, setCount] = useState(5);
  const [results, setResults] = useState([]);

  useEffect(() => {
    fetchNameCategories().then((data) => {
      if (!data) return;
      setCategories(data.categories || []);
      setPlaceLevels(data.place_levels || []);
      setRaces(data.races || []);
      if (data.races && data.races.length > 0) setRace(data.races[0]);
    });
  }, [fetchNameCategories]);

  const handleGenerate = async () => {
    const names = await generateNames({
      category,
      count,
      race: category === 'actor' ? race : undefined,
      placeLevel: category === 'place' ? placeLevel : undefined,
    });
    if (names) setResults(names);
  };

  return (
    <div className="name-generator-backdrop" onClick={onClose}>
      <div className="name-generator mw-panel" onClick={(event) => event.stopPropagation()}>
        <div className="mw-banner">Name Generator</div>

        <div className="name-generator-controls">
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((entry) => (
                <option key={entry} value={entry}>{CATEGORY_LABELS[entry] || entry}</option>
              ))}
            </select>
          </label>

          {category === 'actor' && races.length > 0 && (
            <label>
              Race
              <select value={race} onChange={(event) => setRace(event.target.value)}>
                {races.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
          )}

          {category === 'place' && (
            <label>
              Level
              <select value={placeLevel} onChange={(event) => setPlaceLevel(event.target.value)}>
                {placeLevels.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
          )}

          <label>
            Count
            <input
              type="number"
              min="1"
              max="20"
              value={count}
              onChange={(event) => setCount(Number(event.target.value) || 1)}
            />
          </label>

          <button className="btn btn-primary" onClick={handleGenerate}>Generate</button>
        </div>

        {results.length > 0 && (
          <ul className="name-generator-results">
            {results.map((name, index) => (
              <li key={index}>{name}</li>
            ))}
          </ul>
        )}

        <div className="name-generator-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default NameGenerator;
