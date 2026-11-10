import React, { useRef } from 'react';
import '../styles/ColorSwatch.css';

// Pinned convention: a bare <input type="color"> ignores CSS sizing in
// Chromium and renders as an oversized native widget that breaks row layout,
// so render a fixed-size swatch that proxies clicks to a hidden native input.
function ColorSwatch({ color, onChange, onClear, title }) {
  const inputRef = useRef(null);
  return (
    <span className="color-swatch-wrap">
      <button
        type="button"
        className={`color-swatch ${color ? 'assigned' : ''}`}
        style={color ? { backgroundColor: color } : undefined}
        onClick={() => inputRef.current?.click()}
        title={title}
        aria-label={title}
      />
      <input
        ref={inputRef}
        type="color"
        className="color-swatch-input"
        value={color || '#6b5f4a'}
        onChange={(event) => onChange(event.target.value)}
        tabIndex={-1}
        aria-hidden="true"
      />
      {color && (
        <button type="button" className="btn-small" onClick={onClear} title="Clear marker color">
          ×
        </button>
      )}
    </span>
  );
}

export default ColorSwatch;
