import { Paper, SxProps, Typography } from '@mui/material';
import QuantityButtons from '../../common/QuantityButtons';

interface QuantityProps {
  sx: SxProps;
  quantity: number;
  max?: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
}

const Quantity = ({ sx, quantity, max, disabled = false, onChange }: QuantityProps) => {
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
        max={max}
        disabled={disabled}
        handleChange={onChange}
        sx={{ mb: 1 }}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
        {max ?? 0} available
      </Typography>
    </Paper>
  );
};

export default Quantity;
