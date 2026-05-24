import { MenuItem, TextField } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import { FilterOption } from 'types/ecommerce';
import FilterCollapsiblePanel from './FilterCollapsiblePanel';

interface SortFilterSectionProps {
  defaultOpen: boolean;
  title: string;
  options: FilterOption[];
  name: string;
}

const SortFilterSection = ({ defaultOpen, title, options, name }: SortFilterSectionProps) => {
  const { setValue, watch } = useFormContext();
  const value = watch(name) || options[0]?.value || '';

  return (
    <FilterCollapsiblePanel defaultOpen={defaultOpen} title={title}>
      <TextField
        select
        fullWidth
        value={value}
        onChange={(event) => {
          setValue(name, event.target.value, {
            shouldDirty: true,
            shouldTouch: true,
          });
        }}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    </FilterCollapsiblePanel>
  );
};

export default SortFilterSection;
