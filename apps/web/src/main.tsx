import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './styles/globals.css';

const akar = document.getElementById('root');
if (!akar) throw new Error('Elemen #root tidak ditemukan di index.html');

createRoot(akar).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
