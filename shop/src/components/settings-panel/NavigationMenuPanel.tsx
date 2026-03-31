import { ChangeEvent } from 'react';
import { useSearchParams } from 'react-router';
import { FormControlLabel, Radio } from '@mui/material';
import { NavigationMenuType } from 'config';
import { useSettingsPanelContext } from 'providers/SettingsPanelProvider';
import { useSettingsContext } from 'providers/SettingsProvider';
import { SET_NAVIGATION_MENU_TYPE } from 'reducers/SettingsReducer';
import SettingsItem from './SettingsItem';
import SettingsPanelRadioGroup from './SettingsPanelRadioGroup';
import { ComboIllustration } from './panel-illustrations/ComboIllustration';
import { SidenavIllustration } from './panel-illustrations/SidenavIllustration';
import { TopnavIllustration } from './panel-illustrations/TopnavIllustration';

const NavigationMenuPanel = () => {
  const {
    config: { navigationMenuType },
    configDispatch,
  } = useSettingsContext();
  const [, setSearchParams] = useSearchParams();

  const {
    settingsPanelConfig: { disableNavigationMenuSection },
  } = useSettingsPanelContext();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchParams({}, { replace: true });
    const value = (event.target as HTMLInputElement).value as NavigationMenuType;
    configDispatch({
      type: SET_NAVIGATION_MENU_TYPE,
      payload: value,
    });
  };

  return (
    <SettingsPanelRadioGroup
      name="text-direction"
      value={navigationMenuType}
      onChange={handleChange}
    >
      <FormControlLabel
        value="sidenav"
        control={<Radio />}
        label={
          <SettingsItem
            label="Sidenav"
            image={
              <SidenavIllustration
                active={!disableNavigationMenuSection && navigationMenuType === 'sidenav'}
              />
            }
            active={!disableNavigationMenuSection && navigationMenuType === 'sidenav'}
          />
        }
      />
      <FormControlLabel
        value="topnav"
        control={<Radio />}
        label={
          <SettingsItem
            label="Topnav"
            image={
              <TopnavIllustration
                active={!disableNavigationMenuSection && navigationMenuType === 'topnav'}
              />
            }
            active={!disableNavigationMenuSection && navigationMenuType === 'topnav'}
          />
        }
      />
      <FormControlLabel
        value="combo"
        control={<Radio />}
        label={
          <SettingsItem
            label="Combo"
            image={
              <ComboIllustration
                active={!disableNavigationMenuSection && navigationMenuType === 'combo'}
              />
            }
            active={!disableNavigationMenuSection && navigationMenuType === 'combo'}
          />
        }
      />
    </SettingsPanelRadioGroup>
  );
};

export default NavigationMenuPanel;
