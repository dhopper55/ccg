import { Paper, SxProps, Typography } from '@mui/material';
import QuantityButtons from '../../common/QuantityButtons';

interface QuantityProps {
  sx: SxProps;
  quantity: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
}

const Quantity = ({ sx, quantity, disabled = false, onChange }: QuantityProps) => {
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
        defaultValue={quantity}
        disabled={disabled}
        handleChange={onChange}
        sx={{ mb: 0.5 }}
      />
    </Paper>
  );
};

export default Quantity;
