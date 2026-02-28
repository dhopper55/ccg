import { Button, badgeClasses } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import OutlinedBadge from 'components/styled/OutlinedBadge';

interface NotificationMenuProps {
  type?: 'default' | 'slim';
}

const NotificationMenu = ({ type = 'default' }: NotificationMenuProps) => {
  return (
    <Button
      color="neutral"
      variant={type === 'default' ? 'soft' : 'text'}
      shape="circle"
      size={type === 'slim' ? 'small' : 'medium'}
      aria-label="Notifications"
    >
      <OutlinedBadge
        variant="dot"
        color="error"
        sx={{
          [`& .${badgeClasses.badge}`]: {
            height: 10,
            width: 10,
            top: -2,
            right: -2,
            borderRadius: '50%',
          },
        }}
      >
        <IconifyIcon
          icon={
            type === 'slim'
              ? 'material-symbols:notifications-outline-rounded'
              : 'material-symbols-light:notifications-outline-rounded'
          }
          sx={{ fontSize: type === 'slim' ? 18 : 22 }}
        />
      </OutlinedBadge>
    </Button>
  );
};

export default NotificationMenu;
