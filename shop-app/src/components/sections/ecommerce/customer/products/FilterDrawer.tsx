import { Box, Button, Drawer, Stack, Typography, drawerClasses } from '@mui/material';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { ProductFilterOptions } from 'types/ecommerce';
import IconifyIcon from 'components/base/IconifyIcon';
import FilterPanel from './filter-panel';

interface FilterDrawerProps {
  open: boolean;
  handleClose: () => void;
  drawerWidth: number;
  filterOptions: ProductFilterOptions;
  resultCount?: number;
}

const FilterDrawer = ({ open, handleClose, drawerWidth, filterOptions, resultCount }: FilterDrawerProps) => {
  const { up } = useBreakpoints();
  const upMd = up('md');

  return (
    <>
      {upMd ? (
        <Drawer
          variant="persistent"
          open={open}
          sx={(theme) => ({
            flexShrink: 0,
            display: { xs: 'none', md: 'block' },
            [`& .${drawerClasses.paper}`]: {
              position: 'sticky',
              zIndex: 'unset',
              top: theme.mixins.ecommerceTopbar,
              border: 0,
              overflowY: 'auto',
              width: drawerWidth,
              height: theme.mixins.contentHeight(theme.mixins.ecommerceTopbar),
              outline: `1px solid ${theme.vars.palette.divider}`,
              bgcolor: theme.vars.palette.background.elevation1,
            },
          })}
        >
          <Box sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
            <FilterPanel filterOptions={filterOptions} />
          </Box>
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={open}
          onClose={handleClose}
          ModalProps={{
            disableAutoFocus: true,
            disableEnforceFocus: true,
            disableRestoreFocus: true,
          }}
          sx={(theme) => ({
            display: { xs: 'block', md: 'none' },
            [`& .${drawerClasses.paper}`]: {
              width: `min(${drawerWidth}px, 88vw)`,
              border: 0,
              outline: `1px solid ${theme.vars.palette.divider}`,
              bgcolor: theme.vars.palette.background.elevation1,
              zIndex: theme.zIndex.drawer,
            },
          })}
        >
          <Stack
            direction="column"
            sx={{
              gap: 3,
              px: { xs: 3, md: 5 },
              py: 3,
            }}
          >
            <Stack
              sx={{
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 700,
                }}
              >
                Filters
              </Typography>
              <Button shape="circle" variant="soft" color="neutral" onClick={handleClose}>
                <IconifyIcon icon="material-symbols:close-rounded" sx={{ fontSize: 20 }} />
              </Button>
            </Stack>
            <FilterPanel filterOptions={filterOptions} />
          </Stack>
          {/* Filters apply as they change; this just gets the shopper back to the results. */}
          <Box
            sx={(theme) => ({
              position: 'sticky',
              bottom: 0,
              mt: 'auto',
              px: 3,
              py: 2,
              bgcolor: theme.vars.palette.background.elevation1,
              borderTop: `1px solid ${theme.vars.palette.divider}`,
            })}
          >
            <Button fullWidth variant="contained" color="primary" onClick={handleClose}>
              {resultCount === undefined
                ? 'Show results'
                : `Show ${resultCount} ${resultCount === 1 ? 'item' : 'items'}`}
            </Button>
          </Box>
        </Drawer>
      )}
    </>
  );
};

export default FilterDrawer;
