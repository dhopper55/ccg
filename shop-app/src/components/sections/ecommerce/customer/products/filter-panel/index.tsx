import { Divider, Stack } from '@mui/material';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { ProductFilterOptions } from 'types/ecommerce';
import CategoryFilterSection from './CategoryFilterSection';
import FilterSection from './FilterSection';
import PriceFilterSection from './PriceFilterSection';
import SortFilterSection from './SortFilterSection';

interface FilterPanelProps {
  filterOptions: ProductFilterOptions;
}

const FilterPanel = ({ filterOptions }: FilterPanelProps) => {
  const { up } = useBreakpoints();
  // The category list is long; on phones start it collapsed so Brand and Price are in view.
  const categoryOpenByDefault = up('md');

  return (
    <Stack direction="column" divider={<Divider sx={{ my: 2 }} />} sx={{ mb: 3 }}>
      {filterOptions.availability && (
        <FilterSection
          defaultOpen
          title="Availability"
          options={filterOptions.availability}
          name="availability"
        />
      )}
      {filterOptions.sale && filterOptions.sale.length > 0 && (
        <FilterSection defaultOpen title="Sale" options={filterOptions.sale} name="sale" />
      )}
      {filterOptions.material && filterOptions.material.length > 0 && (
        <FilterSection
          defaultOpen
          options={filterOptions.material}
          name="material"
          title="Material"
        />
      )}
      {filterOptions.sort && filterOptions.sort.length > 0 && (
        <SortFilterSection defaultOpen title="Sort" options={filterOptions.sort} name="sortBy" />
      )}
      {filterOptions.category && (
        <CategoryFilterSection
          defaultOpen={categoryOpenByDefault}
          title="Category"
          options={filterOptions.category}
          name="category"
        />
      )}
      {filterOptions.brand && filterOptions.brand.length > 0 && (
        <FilterSection defaultOpen title="Brand" options={filterOptions.brand} name="brand" />
      )}
      {filterOptions.price && (
        <PriceFilterSection defaultOpen defaultValue={filterOptions.price || [0, 5000]} />
      )}
      {filterOptions.features && filterOptions.features.length > 0 && (
        <FilterSection
          defaultOpen
          title="Features"
          options={filterOptions.features}
          name="features"
        />
      )}
    </Stack>
  );
};

export default FilterPanel;
