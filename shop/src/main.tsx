import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import BreakpointsProvider from 'providers/BreakpointsProvider';
import NotistackProvider from 'providers/NotistackProvider';
import SettingsPanelProvider from 'providers/SettingsPanelProvider';
import SettingsProvider from 'providers/SettingsProvider';
import ThemeProvider from 'providers/ThemeProvider';
import router from 'routes/router';
import './locales/i18n';

function registerAdminV2Pwa(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) return;

  const baseUrl = import.meta.env.BASE_URL || '/';
  if (!baseUrl.startsWith('/admin/')) return;

  void navigator.serviceWorker
    .register(`${baseUrl}admin-v2-sw.js`, { scope: baseUrl })
    .catch((error: unknown) => {
      console.warn('Admin V2 PWA service worker registration failed', error);
    });
}

registerAdminV2Pwa();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <SettingsProvider>
    <ThemeProvider>
      <NotistackProvider>
        <SettingsPanelProvider>
          <BreakpointsProvider>
            <RouterProvider router={router} />
          </BreakpointsProvider>
        </SettingsPanelProvider>
      </NotistackProvider>
    </ThemeProvider>
  </SettingsProvider>,
);
