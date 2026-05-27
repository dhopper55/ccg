import { Box } from '@mui/material';
import PromoBanner from './PromoBanner';
import PrimaryAppbar from './primary';

const EcommerceAppbar = () => {
  return (
    <Box
      sx={{
        height: '100%',
      }}
    >
      <PrimaryAppbar>
        <PromoBanner />
      </PrimaryAppbar>
    </Box>
  );
};

export default EcommerceAppbar;
