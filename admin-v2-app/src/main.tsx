import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import BreakpointsProvider from 'providers/BreakpointsProvider';
import SettingsProvider from 'providers/SettingsProvider';
import ThemeProvider from 'providers/ThemeProvider';
import router from 'routes/router';
import './locales/i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <SettingsProvider>
    <ThemeProvider>
      <BreakpointsProvider>
        <RouterProvider router={router} />
      </BreakpointsProvider>
    </ThemeProvider>
  </SettingsProvider>,
);
