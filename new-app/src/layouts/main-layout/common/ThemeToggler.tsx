import { Box, Button } from '@mui/material';
import { useThemeMode } from 'hooks/useThemeMode';
import { cssVarRgba } from 'lib/utils';
import IconifyIcon from 'components/base/IconifyIcon';

interface ThemeTogglerProps {
  type?: 'default' | 'slim';
}

const sizeMap = {
  default: { box: 39, radius: 7.5, ringInset: 1 },
  slim: { box: 32, radius: 7.25, ringInset: 0.85 },
};

const ThemeToggler = ({ type = 'default' }: ThemeTogglerProps) => {
  const { setThemeMode } = useThemeMode();
  const sizes = sizeMap[type];

  return (
    <Box
      sx={{
        position: 'relative',
        width: sizes.box,
        height: sizes.box,
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: sizes.radius,
          background: ({ vars }) =>
            `linear-gradient(to bottom, ${vars.palette.secondary.main}, ${cssVarRgba(vars.palette.secondary.mainChannel, 0.01)})`,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: sizes.ringInset,
          borderRadius: sizes.radius,
          background: ({ vars }) =>
            type === 'slim' ? vars.palette.background.paper : vars.palette.secondary.light,
        },
      }}
    >
      <Button
        shape="circle"
        color="neutral"
        variant={type === 'default' ? 'soft' : 'text'}
        onClick={() => setThemeMode()}
        size={type === 'slim' ? 'small' : 'medium'}
        sx={{
          position: 'absolute',
          zIndex: 1,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <IconifyIcon
          icon={type === 'slim' ? 'material-symbols:palette-outline' : 'material-symbols-light:palette-outline'}
          sx={{ fontSize: type === 'slim' ? 18 : 22 }}
        />
      </Button>
    </Box>
  );
};

export default ThemeToggler;
