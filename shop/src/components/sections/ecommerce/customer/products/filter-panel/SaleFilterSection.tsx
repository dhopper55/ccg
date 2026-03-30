import { FormControl, FormControlLabel, Radio, RadioGroup, formControlLabelClasses } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import FilterCollapsiblePanel from './FilterCollapsiblePanel';

interface SaleFilterSectionProps {
  defaultOpen: boolean;
}

const SaleFilterSection = ({ defaultOpen }: SaleFilterSectionProps) => {
  const { watch, setValue } = useFormContext();
  const selectedValue = watch('sale') || 'all';

  return (
    <FilterCollapsiblePanel defaultOpen={defaultOpen} title="Sale">
      <FormControl>
        <RadioGroup value={selectedValue} onChange={(event) => setValue('sale', event.target.value)}>
          <FormControlLabel
            value="all"
            control={<Radio />}
            label="All"
            sx={{
              [`& .${formControlLabelClasses.label}`]: {
                fontWeight: 500,
              },
            }}
          />
          <FormControlLabel
            value="on-sale"
            control={<Radio />}
            label="On Sale"
            sx={{
              [`& .${formControlLabelClasses.label}`]: {
                fontWeight: 500,
              },
            }}
          />
          <FormControlLabel
            value="regular-price"
            control={<Radio />}
            label="Regular Price"
            sx={{
              [`& .${formControlLabelClasses.label}`]: {
                fontWeight: 500,
              },
            }}
          />
        </RadioGroup>
      </FormControl>
    </FilterCollapsiblePanel>
  );
};

export default SaleFilterSection;
