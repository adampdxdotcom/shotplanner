// Global Web Crypto polyfill for non-secure HTTP / LAN contexts (e.g. accessing via local IP: 192.168.x.x)
if (typeof window !== 'undefined') {
  const winCrypto = window.crypto || {} as Crypto;
  if (!window.crypto) {
    (window as unknown as { crypto: Crypto }).crypto = winCrypto;
  }
  if (!winCrypto.getRandomValues) {
    (winCrypto as unknown as { getRandomValues: <T extends ArrayBufferView | null>(array: T) => T }).getRandomValues = function <T extends ArrayBufferView | null>(array: T): T {
      if (array) {
        const uint8 = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let i = 0; i < uint8.length; i++) {
          uint8[i] = Math.floor(Math.random() * 256);
        }
      }
      return array;
    };
  }
  if (typeof winCrypto.randomUUID !== 'function') {
    (winCrypto as unknown as { randomUUID: () => string }).randomUUID = function (): string {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './context/ThemeContext.tsx';

// Vite official hook to catch dynamic chunk loading errors on redeployment
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite Preload Error] Stale chunk detected. Refreshing for latest assets...', event);
    const hasReloaded = sessionStorage.getItem('vite_preload_error_reload');
    if (!hasReloaded) {
      sessionStorage.setItem('vite_preload_error_reload', 'true');
      window.location.reload();
    }
  });

  // Clear reload markers on successful clean load
  window.addEventListener('load', () => {
    sessionStorage.removeItem('vite_preload_error_reload');
    sessionStorage.removeItem('chunk_retry_refreshed');
    sessionStorage.removeItem('chunk_error_autoreload');
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);

