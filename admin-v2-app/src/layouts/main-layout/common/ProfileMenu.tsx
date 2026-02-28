import { Button } from '@mui/material';
import { useAuth } from 'providers/AuthProvider';
import StatusAvatar from 'components/base/StatusAvatar';

interface ProfileMenuProps {
  type?: 'default' | 'slim';
}

const ProfileMenu = ({ type = 'default' }: ProfileMenuProps) => {
  const { sessionUser } = useAuth();
  const userName = sessionUser?.name?.trim() || 'Admin';
  const userInitial = userName.charAt(0).toUpperCase() || 'A';

  return (
    <Button
      color="neutral"
      variant="text"
      shape="circle"
      sx={[
        {
          height: 44,
          width: 44,
          minWidth: 44,
        },
        type === 'slim' && {
          height: 30,
          width: 30,
          minWidth: 30,
        },
      ]}
      aria-label={userName}
    >
      <StatusAvatar
        alt={userName}
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
          type === 'slim' && {
            width: 24,
            height: 24,
            border: 1,
            borderColor: 'background.paper',
          },
        ]}
      >
        {userInitial}
      </StatusAvatar>
    </Button>
  );
};

export default ProfileMenu;
