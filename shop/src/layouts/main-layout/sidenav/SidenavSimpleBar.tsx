import { PropsWithChildren } from 'react';
import { Box, BoxProps } from '@mui/material';

interface SidenavSimpleBarProps {
  sx?: BoxProps['sx'];
}

const SidenavSimpleBar = ({ children, sx }: PropsWithChildren<SidenavSimpleBarProps>) => {
  return (
    <Box
      sx={[
        {
          height: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
};

export default SidenavSimpleBar;
