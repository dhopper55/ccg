import { Box, Chip, Stack, SxProps, Typography } from '@mui/material';
import { useEcommerce } from 'providers/EcommerceProvider';
import paths from 'routes/paths';
import PageBreadcrumb from '../../../common/PageBreadcrumb';

interface GeneralInfoProps {
  sx?: SxProps;
  category?: string;
  secondaryCategory?: string;
  title?: string;
  itemNumber?: string;
  condition?: string;
}

const GeneralInfo = ({ sx, category, secondaryCategory, title, itemNumber, condition }: GeneralInfoProps) => {
  const { product } = useEcommerce();
  const conditionLabel = (condition || '').trim();
  const showCondition = Boolean(conditionLabel) && conditionLabel.toLowerCase() !== 'new';
  const breadcrumbItems = [
    { label: 'Home', url: '/' },
    category
      ? {
          label: category,
          url: `${paths.products}?category=${encodeURIComponent(category)}`,
          active: !secondaryCategory,
        }
      : null,
    secondaryCategory
      ? {
          label: secondaryCategory,
          active: true,
        }
      : null,
  ].filter((item): item is { label: string; url?: string; active?: boolean } => Boolean(item));

  return (
    <Box sx={{ ...sx }}>
      <PageBreadcrumb
        items={breadcrumbItems}
        sx={{ mb: { xl: 5, xs: 3 } }}
      />
      <Stack
        direction={{ xs: 'column', lg: 'row', xl: 'column' }}
        sx={{
          justifyContent: 'space-between',
          gap: 3,
        }}
      >
        <Box>
          <Typography variant="h1" sx={{ fontSize: 'h5.fontSize' }}>
            {title || product?.name}
          </Typography>
          {itemNumber ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mt: 0.75 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Item Number: {itemNumber}
              </Typography>
              {showCondition ? (
                <Chip
                  label={conditionLabel}
                  size="small"
                  color="info"
                  variant="soft"
                  sx={{ height: 24, fontWeight: 700 }}
                />
              ) : null}
            </Stack>
          ) : null}
        </Box>
      </Stack>
    </Box>
  );
};

export default GeneralInfo;
