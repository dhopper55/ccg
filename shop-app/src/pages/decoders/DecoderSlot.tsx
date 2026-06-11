import { Box } from '@mui/material';
import { DecoderSlotName, getDecoderSlot } from './decoder-slot-registry';

interface DecoderSlotProps {
  brand: string;
  name: DecoderSlotName;
}

const DecoderSlot = ({ brand, name }: DecoderSlotProps) => {
  const content = getDecoderSlot(brand, name);
  if (!content) return null;
  return <Box sx={{ mb: 1 }}>{content}</Box>;
};

export default DecoderSlot;
