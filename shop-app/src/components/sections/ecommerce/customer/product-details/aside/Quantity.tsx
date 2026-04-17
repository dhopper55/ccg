import { Paper, SxProps, Typography } from '@mui/material';
import QuantityButtons from '../../common/QuantityButtons';

const Quantity = ({ sx }: { sx: SxProps }) => {
  return (
    <Paper sx={{ p: { xs: 3, md: 5 }, ...sx }}>
      <Typography
        variant="h6"
        sx={{
          mb: 3,
        }}
      >
        Quantity
      </Typography>
      <QuantityButtons
        defaultValue={1}
        disabled
        handleChange={() => undefined}
        sx={{ mb: 0.5 }}
      />
    </Paper>
  );
};

export default Quantity;
