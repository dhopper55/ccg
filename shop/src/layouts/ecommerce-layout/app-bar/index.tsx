import { Box } from '@mui/material';
import PrimaryAppbar from './primary';
import SecondaryAppbar from './secondary';

const EcommerceAppbar = () => {
  return (
    <Box
      sx={{
        height: '100%',
      }}
    >
      <PrimaryAppbar>
        <SecondaryAppbar />
      </PrimaryAppbar>
    </Box>
  );
};

export default EcommerceAppbar;
