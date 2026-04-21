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
  const topCard = contentList.find((content) => content.id === 3);

  const filteredItems =
    category === 'all' ? contentList : contentList.filter((content) => content.key === category);
  const gridItems = filteredItems.filter((content) => content.id !== topCard?.id);

  const handleCategory = (_: SyntheticEvent, newValue: string) => setCategory(newValue);

  return (
    <TabContext value={category}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 420px' },
          gap: 2,
          alignItems: 'center',
          mb: { xs: 3, md: 5 },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
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

        {topCard && <ContentCard item={topCard} />}
      </Box>

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
            {gridItems.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </Box>
        </TabPanel>
      ))}

      <Box sx={{ mt: { xs: 3, md: 5 } }}>
        <CategoryTabList
          value={category}
          handleChange={handleCategory}
          contentCategories={contentCategories}
        />
      </Box>
    </TabContext>
  );
};

export default ContentMain;
