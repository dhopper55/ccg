import { useCallback } from 'react';
import { useColorScheme } from '@mui/material';
import { ThemeMode, ThemePreset } from 'config';
import { useSettingsContext } from 'providers/SettingsProvider';
import { SET_PRIMARY_COLOR, SET_THEME_PRESET } from 'reducers/SettingsReducer';
import { darkPalettes } from 'theme/palettes';
import { COLOR_GROUPS } from 'theme/primaryColorOverride';

export const useThemeMode = () => {
  const { mode, systemMode, setMode } = useColorScheme();
  const { config, configDispatch } = useSettingsContext();

  const isDark = mode === 'system' ? systemMode === 'dark' : mode === 'dark';

  const setThemeMode = useCallback(
    (themeMode?: ThemeMode) => {
      setMode(themeMode ?? (isDark ? 'light' : 'dark'));
    },
    [setMode, systemMode, mode],
  );

  const setThemePreset = useCallback(
    (presetName: ThemePreset) => {
      configDispatch({ type: SET_THEME_PRESET, payload: presetName });
      configDispatch({
        type: SET_PRIMARY_COLOR,
        payload: COLOR_GROUPS.find((group) => group.key === presetName)?.main ?? null,
      });
      setMode(presetName in darkPalettes ? 'dark' : 'light');
    },
    [configDispatch],
  );

  const resetTheme = useCallback(() => {
    setMode(null);
  }, [setMode]);

  return {
    mode,
    resetTheme,
    isDark,
    systemMode,
    setThemeMode,
    setThemePreset,
    themePreset: config.themePreset,
  };
};
