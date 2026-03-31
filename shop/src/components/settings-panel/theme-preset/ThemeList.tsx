import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { ThemePreset } from 'config';
import { useThemeMode } from 'hooks/useThemeMode';
import { allPalettes } from 'theme/palettes';
import IconifyIcon from 'components/base/IconifyIcon';
import PrimaryColorPicker from './PrimaryColorPicker';
import ThemeListItem from './ThemeListItem';
import { ThemeRadio, themeListRowSx } from './ThemeRadio';

interface ThemeListProps {
  variant?: 'default' | 'menu';
}

function organizeThemes() {
  const defaultThemes: [ThemePreset, any][] = [];
  const customThemes: [ThemePreset, any][] = [];

  Object.entries(allPalettes).forEach(([preset, palette]) => {
    if (preset.startsWith('default-')) {
      defaultThemes.push([preset as ThemePreset, palette]);
    } else {
      customThemes.push([preset as ThemePreset, palette]);
    }
  });

  return { defaultThemes, customThemes };
}

const ThemeList = ({ variant = 'default' }: ThemeListProps) => {
  const { setThemePreset, themePreset, systemMode } = useThemeMode();
  const [, setSearchParams] = useSearchParams();
  const [isDefaultSectionOpen, setIsDefaultSectionOpen] = useState(true);
  const [isSystemSelected, setIsSystemSelected] = useState(false);

  const handleThemeChange = useCallback(
    (preset: ThemePreset, isSystemTheme = false) => {
      setSearchParams({}, { replace: true });
      setThemePreset(preset);
      setIsSystemSelected(isSystemTheme);
    },
    [setSearchParams, setThemePreset],
  );

  const { defaultThemes, customThemes } = organizeThemes();
  const isDefaultThemeActive = themePreset.startsWith('default-');

  const handleSystemThemeSelect = () => {
    const systemPreset = systemMode === 'dark' ? 'default-dark' : 'default-light';
    handleThemeChange(systemPreset, true);
  };

  const expandIcon = isDefaultSectionOpen
    ? 'material-symbols:keyboard-arrow-up-rounded'
    : 'material-symbols:keyboard-arrow-down-rounded';

  return (
    <>
      <List
        dense
        disablePadding
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: variant === 'default' ? 1 : 0,
        }}
      >
        <ListItem
          secondaryAction={
            <IconButton edge="end" onClick={() => setIsDefaultSectionOpen(!isDefaultSectionOpen)}>
              <IconifyIcon icon={expandIcon} />
            </IconButton>
          }
          dense
          disablePadding
        >
          <ListItemButton
            dense
            selected={isDefaultThemeActive}
            onClick={() => handleThemeChange('default-light')}
            sx={themeListRowSx(variant)}
          >
            <ListItemIcon>
              <ThemeRadio checked={isDefaultThemeActive} />
            </ListItemIcon>
            <ListItemText primary="Default" />
          </ListItemButton>
        </ListItem>

        <Collapse in={isDefaultSectionOpen} timeout="auto" unmountOnExit>
          <List
            disablePadding
            dense
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: variant === 'default' ? 0.5 : 0,
              pl: variant === 'menu' ? 0 : 2,
            }}
          >
            {defaultThemes.map(([preset, palette]) => (
              <ThemeListItem
                key={preset}
                preset={preset}
                palette={palette}
                isSelected={!isSystemSelected && preset === themePreset}
                onSelect={handleThemeChange}
                variant={variant}
                isNested
              />
            ))}

            <ListItem
              secondaryAction={
                <IconifyIcon
                  icon="material-symbols:monitor-outline-rounded"
                  fontSize={18}
                  display="block"
                />
              }
              disablePadding
              sx={{ alignItems: 'center' }}
            >
              <ListItemButton
                dense
                selected={isSystemSelected}
                onClick={handleSystemThemeSelect}
                sx={themeListRowSx(variant, true)}
              >
                <ListItemIcon>
                  <ThemeRadio checked={isSystemSelected} />
                </ListItemIcon>
                <ListItemText primary="System" />
              </ListItemButton>
            </ListItem>
          </List>
        </Collapse>

        {customThemes.map(([preset, palette]) => (
          <ThemeListItem
            key={preset}
            preset={preset}
            palette={palette}
            isSelected={!isSystemSelected && preset === themePreset}
            onSelect={handleThemeChange}
            variant={variant}
          />
        ))}
      </List>

      <PrimaryColorPicker variant={variant} />
    </>
  );
};

export default ThemeList;
