import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MARKER_SYMBOLS, getMarkerSymbol } from '../markerSymbols';
import MarkerSymbol from './MarkerSymbol';
import '../styles/SymbolPicker.css';

const POPOVER_GAP = 4;
const VIEWPORT_MARGIN = 8;
// Must match the grid in SymbolPicker.css: the arrow keys step by it.
const COLUMNS = 4;
const ARROW_STEPS = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS };

// Sits beside the ColorSwatch: a swatch-sized button showing the actor's base
// with its marker symbol (a blank base when none is assigned), opening a small
// grid of drawable shapes.
// The popover is portaled to <body>: actor rows are isolated stacking contexts
// inside a scrolling list, which would otherwise paint over or clip it. Being
// outside the row's tab order, it takes focus on opening and hands it back.
function SymbolPicker({ symbol, color, onChange, title }) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const current = getMarkerSymbol(symbol);

  const closeToButton = () => {
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const isInside = (target) => (
      buttonRef.current?.contains(target) || popoverRef.current?.contains(target)
    );
    const handlePointerDown = (event) => {
      if (!isInside(event.target)) setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      buttonRef.current?.focus();
    };
    // The popover is fixed to the viewport, so any scroll would strand it.
    const close = () => setIsOpen(false);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  // Right-aligned under the button; flips above it when there is no room below.
  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current || !popoverRef.current) return;
    const anchor = buttonRef.current.getBoundingClientRect();
    const popover = popoverRef.current;
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    let top = anchor.bottom + POPOVER_GAP;
    const above = anchor.top - POPOVER_GAP - height;
    if (top + height > window.innerHeight - VIEWPORT_MARGIN && above >= VIEWPORT_MARGIN) top = above;
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(anchor.right - width, maxLeft));
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, [isOpen]);

  const choose = (id) => {
    closeToButton();
    if (id !== (current?.id ?? null)) onChange(id);
  };

  const handlePopoverKeyDown = (event) => {
    const options = [...popoverRef.current.querySelectorAll('button')];
    const index = options.indexOf(document.activeElement);
    if (event.key === 'Tab') {
      // Tabbing past either end leaves the popover: close it and resume from the button.
      if (index === (event.shiftKey ? 0 : options.length - 1)) {
        event.preventDefault();
        closeToButton();
      }
      return;
    }
    const step = ARROW_STEPS[event.key];
    if (!step || index < 0) return;
    event.preventDefault();
    options[Math.max(0, Math.min(index + step, options.length - 1))].focus();
  };

  const buttonTitle = title || (current ? `Marker symbol: ${current.label}` : 'Assign a marker symbol');

  return (
    <span className="symbol-picker">
      <button
        ref={buttonRef}
        type="button"
        className={`symbol-picker-button ${current ? 'assigned' : ''}`}
        onClick={() => setIsOpen((open) => !open)}
        title={buttonTitle}
        aria-label={buttonTitle}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {current ? (
          <MarkerSymbol symbol={current.id} color={color} size={22} />
        ) : (
          // A blank base waiting for a mark. Drawn, not typed: see the glyph-icon convention.
          <svg className="symbol-picker-empty" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3.3 3.3" />
            <path d="M12 8v8M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {isOpen && createPortal(
        <div
          className="symbol-picker-popover"
          role="group"
          aria-label="Marker symbols"
          ref={popoverRef}
          onKeyDown={handlePopoverKeyDown}
        >
          {MARKER_SYMBOLS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`symbol-picker-option ${option.id === current?.id ? 'selected' : ''}`}
              onClick={() => choose(option.id)}
              title={option.label}
              aria-label={option.label}
              aria-pressed={option.id === current?.id}
            >
              <MarkerSymbol symbol={option.id} color={color} size={24} />
            </button>
          ))}
          <button
            type="button"
            className={`symbol-picker-option symbol-picker-none ${current ? '' : 'selected'}`}
            onClick={() => choose(null)}
            title="No symbol"
            aria-label="No symbol"
            aria-pressed={!current}
          >
            None
          </button>
        </div>,
        document.body,
      )}
    </span>
  );
}

export default SymbolPicker;
