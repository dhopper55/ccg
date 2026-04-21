import {
  Box,
  Chip,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
} from '@mui/material';
import { ThemePreset } from 'config';
import { THEME_DISPLAY_NAMES } from 'theme/palettes';
import { ThemeRadio, themeListRowSx } from './ThemeRadio';

const THEME_NEW_PRESETS: Partial<Record<ThemePreset, boolean>> = {
  midnight: true,
  dracula: true,
  luxury: true,
  retro: true,
  arctic: true,
  nature: true,
  ember: true,
};
interface ThemeListItemProps {
  preset: ThemePreset;
  palette: any;
  isSelected: boolean;
  onSelect: (preset: ThemePreset) => void;
  variant?: 'default' | 'menu';
  isNested?: boolean;
}

const ThemeListItem = ({
  preset,
  palette,
  isSelected,
  onSelect,
  variant = 'default',
  isNested = false,
}: ThemeListItemProps) => {
  const colors = [palette.primary?.main, palette.background?.menu];
  const isNew = THEME_NEW_PRESETS[preset] === true;

  return (
    <ListItem disablePadding>
      <ListItemButton
        dense
        selected={isSelected}
        onClick={() => onSelect(preset)}
        sx={themeListRowSx(variant, isNested)}
      >
        <ListItemIcon>
          <ThemeRadio checked={isSelected} />
        </ListItemIcon>

        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isNew
                ? THEME_DISPLAY_NAMES[preset] || preset
                : THEME_DISPLAY_NAMES[preset] || preset}
              {isNew && (
                <Chip
                  size="xsmall"
                  label="new"
                  color="warning"
                  sx={{ textTransform: 'capitalize' }}
                />
              )}
            </Box>
          }
        />

        <Stack direction="row" gap={0.5} alignItems="center">
          {colors.map((bg, i) => (
            <Box
              key={i}
              sx={{
                width: 12,
                height: 12,
                borderRadius: 0.5,
                border: 1,
                borderColor: 'divider',
                bgcolor: bg,
              }}
            />
          ))}
        </Stack>
      </ListItemButton>
    </ListItem>
  );
};

export default ThemeListItem;
