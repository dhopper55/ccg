import { useSearchParams } from 'react-router';
import { Box, Button, Stack, Typography } from '@mui/material';
import { TextDirection } from 'config';
import { useSettingsContext } from 'providers/SettingsProvider';
import IconifyIcon from 'components/base/IconifyIcon';

interface ItemProps {
  label: string;
  icon: string;
  active?: boolean;
  onClick: () => void;
}

const Item = ({ label, icon, active, onClick }: ItemProps) => {
  return (
    <Button
      sx={{
        p: 1,
        pt: 1.5,
        gap: 1,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        bgcolor: active ? 'primary.lighter' : 'background.elevation1',
        position: 'relative',
      }}
      onClick={onClick}
    >
      {active && (
        <IconifyIcon
          icon="material-symbols:check-circle-rounded"
          sx={{
            color: 'primary.main',
            fontSize: 20,
            position: 'absolute',
            top: 4,
            left: 4,
          }}
        />
      )}
      <Box
        sx={{
          height: 24,
          width: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <IconifyIcon
          icon={icon}
          sx={{
            fontSize: 24,
            color: active ? 'primary.main' : 'text.secondary',
          }}
        />
      </Box>
      <Typography
        variant="body2"
        sx={{
          fontWeight: active ? 500 : 400,
          color: active ? 'primary.main' : 'text.secondary',
        }}
      >
        {label}
      </Typography>
    </Button>
  );
};

const TextDirectionPanel = () => {
  const {
    config: { textDirection },
    setConfig,
  } = useSettingsContext();
  const [, setSearchParams] = useSearchParams();

  const handleClick = (value: TextDirection) => {
    setSearchParams({}, { replace: true });
    setConfig({
      textDirection: value,
    });
  };

  return (
    <Stack
      sx={{
        gap: 1,
        flexDirection: 'row',
      }}
    >
      <Item
        label="LTR"
        icon="material-symbols:format-textdirection-l-to-r-outline"
        active={textDirection === 'ltr'}
        onClick={() => handleClick('ltr')}
      />
      <Item
        label="RTL"
        icon="material-symbols:format-textdirection-r-to-l-outline"
        active={textDirection === 'rtl'}
        onClick={() => handleClick('rtl')}
      />
    </Stack>
  );
};

export default TextDirectionPanel;
