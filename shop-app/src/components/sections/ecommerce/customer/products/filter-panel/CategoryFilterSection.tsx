import { Checkbox, FormControlLabel, FormGroup, formControlLabelClasses } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import { FilterOption } from 'types/ecommerce';
import FilterCollapsiblePanel from './FilterCollapsiblePanel';

interface CategoryFilterSectionProps {
  defaultOpen: boolean;
  title: string;
  options: FilterOption[];
  name: string;
}

const CategoryFilterSection = ({ defaultOpen, title, options, name }: CategoryFilterSectionProps) => {
  const { setValue, watch } = useFormContext();
  const selectedValues = (watch(name) || []) as string[];
  const rootOptions = options.filter((option) => !option.parentId);
  const selectedRoot = rootOptions.find((root) => (
    selectedValues.includes(root.value)
    || selectedValues.some((value) => options.find((option) => option.value === value)?.parentId === root.value)
  ));
  const childOptions = selectedRoot
    ? options.filter((option) => option.parentId === selectedRoot.value)
    : [];
  const visibleOptions = selectedRoot ? [selectedRoot, ...childOptions] : rootOptions;

  const handleToggle = (option: FilterOption) => {
    if (!option.parentId) {
      setValue(name, selectedRoot?.value === option.value ? [] : [option.value], {
        shouldDirty: true,
        shouldTouch: true,
      });
      return;
    }

    if (!selectedRoot) return;
    const selectedChildren = childOptions
      .map((child) => child.value)
      .filter((value) => selectedValues.includes(value));
    const nextChildren = selectedChildren.includes(option.value)
      ? selectedChildren.filter((value) => value !== option.value)
      : [...selectedChildren, option.value];

    setValue(name, [selectedRoot.value, ...nextChildren], {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  return (
    <FilterCollapsiblePanel defaultOpen={defaultOpen} title={title}>
      <FormGroup
        sx={{
          [`& .${formControlLabelClasses.label}`]: {
            fontWeight: 500,
          },
        }}
      >
        {visibleOptions.map((option) => (
          <FormControlLabel
            key={option.value}
            control={
              <Checkbox
                value={option.value}
                checked={option.parentId ? selectedValues.includes(option.value) : selectedRoot?.value === option.value}
                onChange={() => handleToggle(option)}
              />
            }
            label={option.label}
          />
        ))}
      </FormGroup>
    </FilterCollapsiblePanel>
  );
};

export default CategoryFilterSection;
