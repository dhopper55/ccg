import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import BreakpointsProvider from 'providers/BreakpointsProvider';
import NotistackProvider from 'providers/NotistackProvider';
import SettingsPanelProvider from 'providers/SettingsPanelProvider';
import SettingsProvider from 'providers/SettingsProvider';
import ThemeProvider from 'providers/ThemeProvider';
import router from 'routes/router';
import './locales/i18n';

// Pages load as separate chunks. If a deploy replaced them while this tab was open, the old
// chunk file is gone; reload to pick up the new build instead of showing a broken page.
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

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
