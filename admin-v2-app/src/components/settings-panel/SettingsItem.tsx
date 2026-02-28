import { ReactElement, isValidElement, useState } from 'react';
import { Box, Typography } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import Image from 'components/base/Image';

interface SettingsItemProps {
  label: string;
  image:
    | string
    | { light: string; dark: string }
    | ReactElement<{ hovered?: boolean; active?: boolean }>;
  active?: boolean;
}

const SettingsItem = ({ label, image, active }: SettingsItemProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const renderImage = () => {
    if (isValidElement(image)) {
      const ImageComponent = image.type as React.ComponentType<{
        hovered?: boolean;
        active?: boolean;
      }>;
      return (
        <Box
          sx={{
            height: 1,
            width: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ImageComponent {...image.props} hovered={isHovered} active={active} />
        </Box>
      );
    }
    return (
      <Image
        src={image as string | { light: string; dark: string }}
        sx={{ height: 1, width: 1, display: 'block' }}
      />
    );
  };

  return (
    <Box
      className="SettingsItem"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={[
        {
          bgcolor: 'none',
          position: 'relative',
        },
      ]}
    >
      <Box
        sx={[
          !!active || isHovered,
          { height: 63, width: 1, position: 'relative', mb: 1, backgroundColor: 'transparent' },
        ]}
      >
        {renderImage()}
      </Box>

      {active && (
        <IconifyIcon
          icon="material-symbols:check-circle-rounded"
          sx={{
            color: 'primary.main',
            fontSize: 20,
            position: 'absolute',
            top: 3,
            left: 3,
          }}
        />
      )}
      <Typography
        variant="subtitle2"
        sx={{
          textAlign: 'center',
          color: active || isHovered ? 'primary.main' : 'text.secondary',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

export default SettingsItem;
