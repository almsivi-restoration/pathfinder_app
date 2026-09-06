import React, { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.js';
import { API_URL } from '../store';
import '../styles/ReferenceReader.css';

GlobalWorkerOptions.workerSrc = workerUrl;

function ReferenceReader({ filename, initialPage = 1, onBack }) {
  const canvasRef = useRef(null);
  const pageContainerRef = useRef(null);
  const [document, setDocument] = useState(null);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [fitScale, setFitScale] = useState(1);
  const [manualScale, setManualScale] = useState(null);
  const [error, setError] = useState('');

  const scale = manualScale ?? fitScale;

  useEffect(() => {
    let active = true;
    setDocument(null);
    setError('');
    setManualScale(null);
    setPageNumber(initialPage);
    setPageInput(String(initialPage));

    getDocument(`${API_URL}/references/current/files/${encodeURIComponent(filename)}`).promise
      .then((pdfDocument) => {
        if (active) {
          setDocument(pdfDocument);
          const clamped = Math.min(Math.max(initialPage, 1), pdfDocument.numPages);
          setPageNumber(clamped);
          setPageInput(String(clamped));
        }
      })
      .catch(() => {
        if (active) setError('The local reference PDF could not be opened.');
      });

    return () => {
      active = false;
    };
  }, [filename, initialPage]);

  useEffect(() => {
    if (!document) return undefined;
    let active = true;

    const measureFit = () => {
      document.getPage(1).then((page) => {
        if (!active) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const container = pageContainerRef.current;
        const availableWidth = (container ? container.clientWidth : 1080) - 40;
        const containerTop = container ? container.getBoundingClientRect().top : 220;
        const availableHeight = window.innerHeight - containerTop - 24;
        const fit = Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height);
        setFitScale(Math.min(Math.max(fit, 0.2), 2.5));
      }).catch(() => {});
    };

    measureFit();
    window.addEventListener('resize', measureFit);
    return () => {
      active = false;
      window.removeEventListener('resize', measureFit);
    };
  }, [document]);

  useEffect(() => {
    if (!document || !canvasRef.current) return undefined;
    let renderTask;
    let active = true;

    document.getPage(pageNumber).then((page) => {
      if (!active || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      renderTask = page.render({ canvasContext: context, viewport });
      return renderTask.promise;
    }).catch(() => {
      if (active) setError('This page could not be rendered.');
    });

    return () => {
      active = false;
      if (renderTask) renderTask.cancel();
    };
  }, [document, pageNumber, scale]);

  const changePage = (target) => {
    if (!document) return;
    const clamped = Math.min(Math.max(target, 1), document.numPages);
    setPageNumber(clamped);
    setPageInput(String(clamped));
  };

  const submitPageInput = (raw) => {
    const parsed = Number(raw);
    if (document && Number.isInteger(parsed) && parsed >= 1 && parsed <= document.numPages) {
      changePage(parsed);
    } else {
      setPageInput(String(pageNumber));
    }
  };

  const zoomTo = (next) => {
    setManualScale(Math.min(Math.max(parseFloat(next.toFixed(2)), 0.2), 3));
  };

  return (
    <main className="reference-reader">
      <header className="reference-reader-header">
        <div>
          <h1>Reference Reader</h1>
          <p>{filename}</p>
        </div>
        <button className="btn btn-secondary" onClick={onBack}>Back to Encyclopedia</button>
      </header>

      {error ? (
        <section className="reference-reader-message">{error}</section>
      ) : !document ? (
        <section className="reference-reader-message">Opening local reference...</section>
      ) : (
        <>
          <div className="reader-controls">
            <button className="btn-small" disabled={pageNumber <= 1} onClick={() => changePage(pageNumber - 1)}>Previous Page</button>
            <span>
              Page{' '}
              <input
                className="reader-page-input"
                type="number"
                min={1}
                max={document.numPages}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onBlur={(event) => submitPageInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitPageInput(event.target.value);
                }}
                aria-label="Page number"
              />
              {' '}of {document.numPages}
            </span>
            <button className="btn-small" disabled={pageNumber >= document.numPages} onClick={() => changePage(pageNumber + 1)}>Next Page</button>
            <button className="btn-small" disabled={scale <= 0.2} onClick={() => zoomTo(scale - 0.15)}>Zoom Out</button>
            <button className="btn-small" onClick={() => setManualScale(null)} disabled={manualScale === null}>Fit Page</button>
            <button className="btn-small btn-add" disabled={scale >= 3} onClick={() => zoomTo(scale + 0.15)}>Zoom In</button>
          </div>
          <div className="reader-page" ref={pageContainerRef}><canvas ref={canvasRef} /></div>
        </>
      )}
    </main>
  );
}

export default ReferenceReader;