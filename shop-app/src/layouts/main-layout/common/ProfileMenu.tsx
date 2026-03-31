import { useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Menu,
  MenuItem,
  Stack,
  Typography,
  listClasses,
  paperClasses,
} from '@mui/material';
import { useAuth } from 'providers/AuthProvider';
import IconifyIcon from 'components/base/IconifyIcon';
import StatusAvatar from 'components/base/StatusAvatar';

interface ProfileMenuProps {
  type?: 'default' | 'slim';
}

const ProfileMenu = ({ type = 'default' }: ProfileMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { signout } = useAuth();

  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const handleSignout = () => {
    signout();
    handleClose();
  };

  return (
    <>
      <Button
        color="neutral"
        variant="text"
        shape="circle"
        onClick={handleClick}
        aria-label="Admin menu"
        sx={[
          { height: 44, width: 44, minWidth: 44 },
          type === 'slim' && { height: 30, width: 30, minWidth: 30 },
        ]}
      >
        <StatusAvatar
          alt="Admin"
          status="online"
          sx={[
            {
              width: 40,
              height: 40,
              border: 2,
              borderColor: 'background.paper',
              bgcolor: 'primary.main',
              color: 'common.black',
              fontWeight: 700,
            },
            type === 'slim' && { width: 24, height: 24, border: 1 },
          ]}
        >
          <IconifyIcon icon="material-symbols:person-rounded" fontSize={22} />
        </StatusAvatar>
      </Button>

      <Menu
        anchorEl={anchorEl}
        id="profile-menu"
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        sx={{
          [`& .${paperClasses.root}`]: { minWidth: 240 },
          [`& .${listClasses.root}`]: { py: 0 },
        }}
      >
        <Stack sx={{ alignItems: 'center', gap: 2, p: 2 }}>
          <StatusAvatar
            status="online"
            alt="Admin"
            sx={{ width: 48, height: 48, bgcolor: 'primary.main', color: 'common.black' }}
          >
            <IconifyIcon icon="material-symbols:person-rounded" fontSize={28} />
          </StatusAvatar>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              Admin
            </Typography>
            <Typography variant="subtitle2" sx={{ color: 'warning.main' }}>
              Administrator
            </Typography>
          </Box>
        </Stack>

        <Divider />
        <Box sx={{ py: 1 }}>
          <MenuItem onClick={handleSignout}>Logout</MenuItem>
        </Box>
      </Menu>
    </>
  );
};

export default ProfileMenu;
