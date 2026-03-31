import { PropsWithChildren, memo, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { Theme } from '@mui/material/styles';
import { ThemePreset } from 'config';
import { lightPalettes } from 'theme/palettes';
import { createTheme } from 'theme/theme';

const themeCache = new Map<string, Theme>();

const getThemeCacheKey = (preset: ThemePreset, cssVarPrefix: string): string => {
  return `${preset}-${cssVarPrefix}`;
};

const getTheme = (preset: ThemePreset, cssVarPrefix: string): Theme => {
  const cacheKey = getThemeCacheKey(preset, cssVarPrefix);
  const cached = themeCache.get(cacheKey);
  if (cached) return cached;

  const theme = createTheme({ preset, cssVarPrefix });
  themeCache.set(cacheKey, theme);
  return theme;
};

const NestedThemeProvider = memo(
  ({ children, preset }: PropsWithChildren<{ preset: ThemePreset }>) => {
    const mode = useMemo(() => (preset in lightPalettes ? 'light' : 'dark'), [preset]);

    const cssVarPrefix = useMemo(() => `aurora-${preset}`, [preset]);

    const theme = useMemo(() => getTheme(preset, cssVarPrefix), [preset, cssVarPrefix]);

    return (
      <div data-aurora-color-scheme={mode}>
        <MuiThemeProvider theme={theme} disableTransitionOnChange>
          {children}
        </MuiThemeProvider>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.preset === nextProps.preset,
);

NestedThemeProvider.displayName = 'NestedThemeProvider';

export default NestedThemeProvider;
