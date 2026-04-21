import { PropsWithChildren, useMemo } from 'react';
import { CssBaseline, ThemeProvider as MuiThemeProvider } from '@mui/material';
import RTLMode from 'theme/RTLMode';
import { createTheme } from 'theme/theme.ts';
import { useSettingsContext } from './SettingsProvider';

export type ThemeMode = 'light' | 'dark' | 'system';

const ThemeProvider = ({ children }: PropsWithChildren) => {
  const {
    config: { textDirection, locale, themePreset, fontFamily, fontSize, primaryColor },
  } = useSettingsContext();

  const customTheme = useMemo(() => {
    const theme = createTheme({
      direction: textDirection,
      locale,
      preset: themePreset,
      fontFamily,
      fontSize,
      primaryColor,
    });

    return theme;
  }, [fontFamily, fontSize, locale, primaryColor, textDirection, themePreset]);

  return (
    <MuiThemeProvider
      disableTransitionOnChange
      theme={customTheme}
      defaultMode="dark"
      modeStorageKey="ccg-new-mode"
    >
      <CssBaseline enableColorScheme />
      <RTLMode>{children}</RTLMode>
    </MuiThemeProvider>
  );
};

export default ThemeProvider;
