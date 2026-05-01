import { Box, Stack, SxProps, Typography } from '@mui/material';
import { useEcommerce } from 'providers/EcommerceProvider';
import paths from 'routes/paths';
import PageBreadcrumb from '../../../common/PageBreadcrumb';

interface GeneralInfoProps {
  sx?: SxProps;
  category?: string;
  secondaryCategory?: string;
  title?: string;
  itemNumber?: string;
}

const GeneralInfo = ({ sx, category, secondaryCategory, title, itemNumber }: GeneralInfoProps) => {
  const { product } = useEcommerce();
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
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
              Item Number: {itemNumber}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Box>
  );
};

export default GeneralInfo;
