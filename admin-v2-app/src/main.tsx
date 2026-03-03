import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import BreakpointsProvider from 'providers/BreakpointsProvider';
import NotistackProvider from 'providers/NotistackProvider';
import SettingsProvider from 'providers/SettingsProvider';
import ThemeProvider from 'providers/ThemeProvider';
import router from 'routes/router';
import './locales/i18n';

function restoreAdminV2Route(): void {
  if (typeof window === 'undefined') return;

  const { pathname, search } = window.location;
  if (!pathname.endsWith('/index.html')) return;

  const params = new URLSearchParams(search);
  const requestedPath = params.get('ccg_admin_v2_path');
  const baseUrl = import.meta.env.BASE_URL || '/';

  if (requestedPath && requestedPath.startsWith('/admin-v2/')) {
    window.history.replaceState({}, '', requestedPath);
    return;
  }

  window.history.replaceState({}, '', baseUrl);
}

function registerAdminV2Pwa(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) return;

  const baseUrl = import.meta.env.BASE_URL || '/';
  if (!baseUrl.startsWith('/admin-v2/')) return;

  void navigator.serviceWorker
    .register(`${baseUrl}admin-v2-sw.js`, { scope: baseUrl })
    .catch((error: unknown) => {
      console.warn('Admin V2 PWA service worker registration failed', error);
    });
}

restoreAdminV2Route();
registerAdminV2Pwa();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <SettingsProvider>
    <ThemeProvider>
      <NotistackProvider>
        <BreakpointsProvider>
          <RouterProvider router={router} />
        </BreakpointsProvider>
      </NotistackProvider>
    </ThemeProvider>
  </SettingsProvider>,
);
