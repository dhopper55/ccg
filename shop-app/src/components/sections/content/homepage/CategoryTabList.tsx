import { SyntheticEvent } from 'react';
import { Chip, Tab, Tabs, tabsClasses } from '@mui/material';

interface CategoryTabListProps {
  contentCategories: { key: string; label: string }[];
  value: string;
  handleChange: (e: SyntheticEvent, newValue: string) => void;
}

const CategoryTabList = ({ contentCategories, value, handleChange }: CategoryTabListProps) => (
  <Tabs
    value={value}
    onChange={handleChange}
    variant="scrollable"
    scrollButtons
    allowScrollButtonsMobile
    sx={{
      mb: 5,
      [`& .${tabsClasses.indicator}`]: { display: 'none' },
      [`& .${tabsClasses.scrollButtons}.Mui-disabled`]: { opacity: 0.3 },
    }}
  >
    {contentCategories.map(({ key, label }) => (
      <Tab
        key={key}
        value={key}
        label={<Chip label={label} size="large" color={value === key ? 'primary' : 'default'} />}
        sx={{ p: 0, borderRadius: 4 }}
      />
    ))}
  </Tabs>
);

export default CategoryTabList;
