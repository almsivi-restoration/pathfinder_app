import React, { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.js';
import { API_URL } from '../store';
import '../styles/ReferenceReader.css';

GlobalWorkerOptions.workerSrc = workerUrl;

function ReferenceReader({ filename, initialPage = 1, onBack }) {
  const canvasRef = useRef(null);
  const [document, setDocument] = useState(null);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [scale, setScale] = useState(1.15);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setDocument(null);
    setError('');
    setPageNumber(initialPage);

    getDocument(`${API_URL}/references/current/files/${encodeURIComponent(filename)}`).promise
      .then((pdfDocument) => {
        if (active) {
          setDocument(pdfDocument);
          setPageNumber(Math.min(Math.max(initialPage, 1), pdfDocument.numPages));
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
            <button className="btn-small" disabled={pageNumber <= 1} onClick={() => setPageNumber(pageNumber - 1)}>Previous Page</button>
            <span>Page {pageNumber} of {document.numPages}</span>
            <button className="btn-small" disabled={pageNumber >= document.numPages} onClick={() => setPageNumber(pageNumber + 1)}>Next Page</button>
            <button className="btn-small" disabled={scale <= 0.65} onClick={() => setScale(scale - 0.15)}>Zoom Out</button>
            <button className="btn-small btn-add" disabled={scale >= 2.5} onClick={() => setScale(scale + 0.15)}>Zoom In</button>
          </div>
          <div className="reader-page"><canvas ref={canvasRef} /></div>
        </>
      )}
    </main>
  );
}

export default ReferenceReader;