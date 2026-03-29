import { PropsWithChildren } from 'react';
import { Box, ButtonBase, Paper, Stack, SxProps, Typography } from '@mui/material';
import { cssVarRgba } from 'lib/utils';
import { useSettingsContext } from 'providers/SettingsProvider';
import paths from 'routes/paths';
import Image from 'components/base/Image';
import PageBreadcrumb from 'components/sections/common/PageBreadcrumb';

interface PageHeaderProps {
  title: string;
  breadcrumb: { label: string; url?: string; active?: boolean }[];
  userLoggedIn?: boolean;
  sx?: SxProps;
}

const PageHeader = ({
  title,
  breadcrumb,
  userLoggedIn,
  sx,
}: PropsWithChildren<PageHeaderProps>) => {
  const {
    config: { assetsDir },
  } = useSettingsContext();

  return (
    <Paper sx={{ py: 4, px: { xs: 3, md: 5 }, ...sx }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        sx={{
          rowGap: 3,
          columnGap: 5,
          alignItems: { md: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Box
          sx={[
            {
              flexShrink: 0,
            },
            userLoggedIn === true && {
              flex: { xl: '50%' },
            },
          ]}
        >
          <PageBreadcrumb items={breadcrumb} sx={{ mb: 1 }} />
          <Typography variant="h4">{title}</Typography>
        </Box>

        {userLoggedIn ? (
          <ButtonBase
            href={paths.products}
            sx={{
              display: 'flex',
              maxHeight: 90,
              position: 'relative',
              borderRadius: 2,
              py: 2,
              pl: 3,
              pr: 1,
              overflow: 'visible',
              bgcolor: ({ vars }) => cssVarRgba(vars.palette.error.mainChannel, 0.08),
              '&::before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                left: 0,
                top: 0,
                width: 1,
                height: 1,
                backgroundImage: `url(${assetsDir}/images/ecommerce/promo/2.webp)`,
                opacity: 0.2,
                backgroundBlendMode: 'lighten',
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                zIndex: 1,
                borderRadius: 'inherit',
              },
            }}
          >
            <Stack
              sx={{
                gap: { md: 1 },
                alignItems: 'center',
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  mr: 1,
                  color: 'error.darker',
                  fontSize: { xs: 'h6.fontSize', sm: 'h4.fontSize' },
                }}
              >
                <Box component="span" sx={{ fontWeight: 400 }}>
                  Plants on Sale for
                </Box>{' '}
                <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                  Mother’s Day
                </Box>
              </Typography>

              <Image
                src={`${assetsDir}/images/ecommerce/promo/1.webp`}
                alt="Plant on Sale"
                sx={{
                  position: 'relative',
                  display: 'block',
                  zIndex: 1,
                  bottom: 16,
                  right: 0,
                  height: 110,
                }}
              />
            </Stack>
          </ButtonBase>
        ) : null}
      </Stack>
    </Paper>
  );
};

export default PageHeader;
