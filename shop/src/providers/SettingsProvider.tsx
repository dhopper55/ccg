import {
  Dispatch,
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Config, initialConfig } from 'config';
import { getColor } from 'helpers/echart-utils';
import { getItemFromStore } from 'lib/utils';
import {
  ACTIONTYPE,
  COLLAPSE_NAVBAR,
  EXPAND_NAVBAR,
  SET_CONFIG,
  settingsReducer,
} from 'reducers/SettingsReducer';
import { COLOR_GROUPS } from 'theme/primaryColorOverride';

interface SettingsContextInterFace {
  config: Config;
  configDispatch: Dispatch<ACTIONTYPE>;
  setConfig: (payload: Partial<Config>) => void;
  handleDrawerToggle: () => void;
  toggleNavbarCollapse: () => void;
  getThemeColor: (color: string) => string;
}

export const SettingsContext = createContext({} as SettingsContextInterFace);

const SettingsProvider = ({ children }: PropsWithChildren) => {
  let primaryColor: string | null | undefined = null;
  const themePreset = 'default-dark' as Config['themePreset'];

  if (!primaryColor && themePreset) {
    const colorGroup = COLOR_GROUPS.find((group) => group.key === themePreset);
    if (colorGroup) {
      primaryColor = colorGroup.main;
    }
  }

  const configState: Config = {
    ...initialConfig,
    sidenavCollapsed: getItemFromStore('sidenavCollapsed', initialConfig.sidenavCollapsed),
    sidenavType: getItemFromStore('sidenavType', initialConfig.sidenavType),
    topnavType: getItemFromStore('topnavType', initialConfig.topnavType),
    textDirection: getItemFromStore('textDirection', initialConfig.textDirection),
    navigationMenuType: getItemFromStore('navigationMenuType', initialConfig.navigationMenuType),
    navColor: getItemFromStore('navColor', initialConfig.navColor),
    locale: getItemFromStore('locale', initialConfig.locale),
    fontFamily: getItemFromStore('fontFamily', initialConfig.fontFamily),
    fontSize: getItemFromStore('fontSize', initialConfig.fontSize.toString()),
    themePreset: themePreset as Config['themePreset'],
    primaryColor,
  };
  const [config, configDispatch] = useReducer(settingsReducer, configState);
  const { i18n } = useTranslation();

  const setConfig = useCallback(
    (payload: Partial<Config>) => {
      configDispatch({
        type: SET_CONFIG,
        payload,
      });
    },
    [configDispatch],
  );

  const handleDrawerToggle = () => {
    setConfig({
      openNavbarDrawer: !config.openNavbarDrawer,
    });
  };

  const toggleNavbarCollapse = () => {
    if (config.sidenavCollapsed) {
      configDispatch({
        type: EXPAND_NAVBAR,
      });
    } else {
      configDispatch({
        type: COLLAPSE_NAVBAR,
      });
    }
  };

  const getThemeColor = (color: string) => {
    return getColor(color);
  };

  useEffect(() => {
    i18n.changeLanguage(config.locale.split('-').join(''));
  }, [config.locale]);

  return (
    <SettingsContext.Provider
      value={{
        config,
        configDispatch,
        setConfig,
        handleDrawerToggle,
        toggleNavbarCollapse,
        getThemeColor,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = (): SettingsContextInterFace => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
};

export default SettingsProvider;
