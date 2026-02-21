import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n'; // Initialize i18n before rendering React app
import App from './App';
import { DialogProvider } from './contexts/DialogContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </React.StrictMode>
);
