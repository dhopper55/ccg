import { Box } from '@mui/material';

export type DecoderSlotName = 'aboveFaq';

type SlotComponent = () => JSX.Element;
type BrandSlots = Partial<Record<DecoderSlotName, SlotComponent>>;

const registry: Record<string, BrandSlots> = {
  fender: {
    aboveFaq: () => (
      <Box
        component="a"
        href="https://www.coalcreekguitars.com/fender-guitar-serial-number-history.html"
        target="_blank"
        rel="noreferrer"
        sx={{
          display: 'inline-block',
          fontSize: '0.875rem',
          color: 'text.primary',
          textDecoration: 'underline',
          textUnderlineOffset: '0.2em',
          '&:hover': { opacity: 0.75 },
        }}
      >
        Fender Guitar Serial Number History
      </Box>
    ),
  },
  gibson: {
    aboveFaq: () => (
      <Box
        component="a"
        href="https://www.coalcreekguitars.com/gibson-guitar-serial-number-history.html"
        target="_blank"
        rel="noreferrer"
        sx={{
          display: 'inline-block',
          fontSize: '0.875rem',
          color: 'text.primary',
          textDecoration: 'underline',
          textUnderlineOffset: '0.2em',
          '&:hover': { opacity: 0.75 },
        }}
      >
        Gibson Guitar Serial Number History
      </Box>
    ),
  },
};

export function getDecoderSlot(brand: string, slot: DecoderSlotName): SlotComponent | null {
  return registry[brand.toLowerCase()]?.[slot] ?? null;
}
