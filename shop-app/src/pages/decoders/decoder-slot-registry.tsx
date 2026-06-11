import { ReactNode } from 'react';
import { Box } from '@mui/material';

export type DecoderSlotName = 'aboveFaq';

type BrandSlots = Partial<Record<DecoderSlotName, ReactNode>>;

const registry: Record<string, BrandSlots> = {
  fender: {
    aboveFaq: (
      <Box
        component="a"
        href="https://www.coalcreekguitars.com/fender-guitar-serial-number-history.html"
        target="_blank"
        rel="noreferrer"
        sx={{
          display: 'inline-block',
          fontSize: '0.875rem',
          color: 'text.secondary',
          textDecoration: 'underline',
          textUnderlineOffset: '0.2em',
          '&:hover': { color: 'text.primary' },
        }}
      >
        Fender Guitar Serial Number History
      </Box>
    ),
  },
  gibson: {
    aboveFaq: (
      <Box
        component="a"
        href="https://www.coalcreekguitars.com/gibson-guitar-serial-number-history.html"
        target="_blank"
        rel="noreferrer"
        sx={{
          display: 'inline-block',
          fontSize: '0.875rem',
          color: 'text.secondary',
          textDecoration: 'underline',
          textUnderlineOffset: '0.2em',
          '&:hover': { color: 'text.primary' },
        }}
      >
        Gibson Guitar Serial Number History
      </Box>
    ),
  },
};

export function getDecoderSlot(brand: string, slot: DecoderSlotName): ReactNode | null {
  return registry[brand.toLowerCase()]?.[slot] ?? null;
}
