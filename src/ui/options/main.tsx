import React from 'react';
import ReactDOM from 'react-dom/client';
import { OptionsPage } from './OptionsPage';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <OptionsPage />
    </React.StrictMode>
  );
}