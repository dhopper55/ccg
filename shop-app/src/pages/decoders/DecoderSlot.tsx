import { Box } from '@mui/material';
import { DecoderSlotName, getDecoderSlot } from './decoder-slot-registry';

interface DecoderSlotProps {
  brand: string;
  name: DecoderSlotName;
}

const DecoderSlot = ({ brand, name }: DecoderSlotProps) => {
  const SlotContent = getDecoderSlot(brand, name);
  if (!SlotContent) return null;
  return (
    <Box sx={{ mb: 1.5 }}>
      <SlotContent />
    </Box>
  );
};

export default DecoderSlot;
