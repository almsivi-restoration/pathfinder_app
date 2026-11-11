import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../styles/AboutDialog.css';

export default function AboutDialog({ details, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current.focus();
    return () => previousFocus?.focus();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab') {
      const targets = dialogRef.current.querySelectorAll('button, [tabindex="0"]');
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return createPortal(
    <div className="about-overlay" onClick={onClose}>
      <section
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header className="about-header">
          <h2 id="about-title">About Game Master's Workbench</h2>
          <p>Version {details.version}</p>
        </header>
        <div className="about-body" role="region" aria-label="About details" tabIndex={0}>
          {details.description.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          <h3>Data directory</h3>
          <p>{details.dataDirectory}</p>
        </div>
        <footer className="about-footer">
          <button type="button" className="btn btn-secondary" ref={closeRef} onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
