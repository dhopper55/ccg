import { PropsWithChildren } from 'react';
import { Button, ButtonProps, SxProps } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

interface ControlButtonProps extends ButtonProps {
  icon: string;
  iconProps?: SxProps;
}

const ControlButton = ({
  icon,
  iconProps,
  children,
  sx,
  ...rest
}: PropsWithChildren<ControlButtonProps>) => {
  return (
    <Button
      shape={children ? undefined : 'square'}
      size="small"
      color="neutral"
      sx={{ gap: children ? 0.5 : 0, ...sx }}
      {...rest}
    >
      <IconifyIcon
        icon={icon}
        sx={{
          fontSize: 18,
          flexShrink: 0,
          ...iconProps,
        }}
      />
      {children}
    </Button>
  );
};

export default ControlButton;
