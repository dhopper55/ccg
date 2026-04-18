import { Box, Typography } from '@mui/material';

interface PickupLocationProps {
  zip: string;
}

const ZIP_MAP_CENTERS: Record<string, { lat: number; lng: number; label: string }> = {
  '80113': { lat: 39.6478, lng: -104.9878, label: 'Englewood, CO 80113' },
};

const PickupLocation = ({ zip }: PickupLocationProps) => {
  const cleanZip = zip.trim();
  const mapCenter = ZIP_MAP_CENTERS[cleanZip];
  const mapParams = mapCenter
    ? new URLSearchParams({
        q: `loc:${mapCenter.lat},${mapCenter.lng}`,
        z: '13',
        output: 'embed',
      })
    : new URLSearchParams({
        q: `${cleanZip} United States`,
        z: '13',
        output: 'embed',
      });
  const mapSrc = `https://maps.google.com/maps?${mapParams.toString()}`;
  const locationLabel = mapCenter?.label || cleanZip;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Pickup location
      </Typography>
      <Box
        sx={{
          width: { xs: 1, md: '50%' },
          minWidth: 0,
        }}
      >
        <Box
          component="iframe"
          title={`Pickup location near ${locationLabel}`}
          src={mapSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          sx={{
            display: 'block',
            width: 1,
            height: { xs: 240, md: 300 },
            border: 0,
            borderRadius: 1,
          }}
        />
      </Box>
    </Box>
  );
};

export default PickupLocation;
