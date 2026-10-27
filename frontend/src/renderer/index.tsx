import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setDataSender } from '@adaptivebehaviour/data/src/sender';
import { createIpcSender } from '@adaptivebehaviour/desktop/src/data/ipcSender';
import { App } from './App';
import { ab } from './ab';
import './registry';
import './styles.css';

// The data collection sends through the main process, which hands everything to this application's data destination.
setDataSender(createIpcSender(ab));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
