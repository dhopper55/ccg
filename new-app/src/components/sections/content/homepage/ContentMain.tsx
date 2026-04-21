import { SyntheticEvent, useState } from 'react';
import { TabContext, TabPanel } from '@mui/lab';
import { Box } from '@mui/material';
import { contentList } from 'data/content/homepage';
import CategoryTabList from './CategoryTabList';
import ContentCard from './ContentCard';

const getUniqueCategories = () => [
  { key: 'all', label: 'All' },
  ...Array.from(
    new Map(contentList.map(({ key, category }) => [key, category])),
    ([key, label]) => ({ key, label }),
  ),
];

const ContentMain = () => {
  const [category, setCategory] = useState('all');
  const contentCategories = getUniqueCategories();

  const filteredItems =
    category === 'all' ? contentList : contentList.filter((content) => content.key === category);

  const handleCategory = (_: SyntheticEvent, newValue: string) => setCategory(newValue);

  return (
    <TabContext value={category}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          mb: { xs: 3, md: 4 },
        }}
      >
        <Box
          component="img"
          src={`${import.meta.env.BASE_URL}images/coal-creek-logo.png`}
          alt="Coal Creek Guitars"
          sx={{
            width: { xs: 240, sm: 300 },
            maxWidth: '60vw',
            height: 'auto',
            display: 'block',
          }}
        />
      </Box>

      <CategoryTabList
        value={category}
        handleChange={handleCategory}
        contentCategories={contentCategories}
      />

      {contentCategories.map(({ key }) => (
        <TabPanel key={key} value={key} sx={{ p: 0 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr',
                lg: '1fr 1fr 1fr',
                xl: '1fr 1fr 1fr 1fr',
              },
              gridAutoFlow: 'dense',
              gap: 2,
            }}
          >
            {filteredItems.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </Box>
        </TabPanel>
      ))}
    </TabContext>
  );
};

export default ContentMain;
