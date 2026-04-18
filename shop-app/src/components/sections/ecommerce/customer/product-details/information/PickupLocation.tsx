import { Box, Typography } from '@mui/material';

interface PickupLocationProps {
  zip: string;
}

const PickupLocation = ({ zip }: PickupLocationProps) => {
  const cleanZip = zip.trim();
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(`${cleanZip}, USA`)}&z=11&output=embed`;

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
          title={`Pickup location near ${cleanZip}`}
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
