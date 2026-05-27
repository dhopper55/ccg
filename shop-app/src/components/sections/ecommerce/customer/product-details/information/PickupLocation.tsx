import { Box, Typography } from '@mui/material';

interface PickupLocationProps {
  zip: string;
}

const ZIP_LOCATION_LABELS: Record<string, string> = {
  '80113': 'Englewood, CO',
};

const PickupLocation = ({ zip }: PickupLocationProps) => {
  const cleanZip = zip.trim();
  const locationLabel = ZIP_LOCATION_LABELS[cleanZip] || cleanZip;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Pickup location ({locationLabel})
      </Typography>
      <Box
        sx={{
          width: { xs: 1, md: '50%' },
          minWidth: 0,
        }}
      >
        <Box
          component="img"
          title={`Pickup location near ${locationLabel}`}
          src="/images/pickup-location-englewood.svg"
          alt={`Pickup location near ${locationLabel}`}
          loading="lazy"
          sx={{
            display: 'block',
            width: 1,
            height: { xs: 240, md: 300 },
            objectFit: 'cover',
            borderRadius: 1,
          }}
        />
      </Box>
    </Box>
  );
};

export default PickupLocation;
