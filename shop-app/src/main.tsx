import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import BreakpointsProvider from 'providers/BreakpointsProvider';
import NotistackProvider from 'providers/NotistackProvider';
import SettingsPanelProvider from 'providers/SettingsPanelProvider';
import SettingsProvider from 'providers/SettingsProvider';
import ThemeProvider from 'providers/ThemeProvider';
import router from 'routes/router';
import './locales/i18n';

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
