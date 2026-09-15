import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initThemeBridge } from './theme';
import './styles/theme.css';

initThemeBridge();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
