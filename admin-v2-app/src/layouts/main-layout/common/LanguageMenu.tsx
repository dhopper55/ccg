import { Box } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

interface LanguageMenuProps {
  type?: 'default' | 'slim';
}

const LanguageMenu = ({ type = 'default' }: LanguageMenuProps) => {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: type === 'slim' ? 32 : 40,
        height: type === 'slim' ? 32 : 40,
      }}
    >
      <IconifyIcon icon="flag:us-4x3" sx={{ fontSize: type === 'slim' ? 20 : 24 }} />
    </Box>
  );
};

export default LanguageMenu;
