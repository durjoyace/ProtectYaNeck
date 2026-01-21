import React from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsPage } from './SettingsPage';
import './options.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<SettingsPage />);
}
