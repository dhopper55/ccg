import React, { MouseEvent, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  Typography,
  popoverClasses,
  useTheme,
} from '@mui/material';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import IconifyIcon from 'components/base/IconifyIcon';
import SimpleBar from 'components/base/SimpleBar';
import { ShopCategoryNode } from './index';

interface CategoryPopoverProps {
  anchorEl: HTMLButtonElement | null;
  categories: ShopCategoryNode[];
  handleClose: () => void;
  openItem: number;
  setOpenItem: React.Dispatch<React.SetStateAction<number>>;
}

interface SubmenuState {
  anchorEl: HTMLElement | null;
  category: ShopCategoryNode | null;
}

interface CategoryListProps {
  categories: ShopCategoryNode[];
  setOpenItem: React.Dispatch<React.SetStateAction<number>>;
}

const CategoryList = ({ categories, setOpenItem }: CategoryListProps) => {
  const { direction } = useTheme();
  const { up, down } = useBreakpoints();
  const upMd = up('md');
  const downMd = down('md');
  const [submenu, setSubmenu] = useState<SubmenuState>({ anchorEl: null, category: null });

  useEffect(() => {
    if (categories.length === 0) {
      setSubmenu({ anchorEl: null, category: null });
    }
  }, [categories]);

  const openSubmenu = (event: MouseEvent<HTMLElement>, category: ShopCategoryNode) => {
    if (!category.children.length) return;
    setSubmenu({
      anchorEl: event.currentTarget,
      category,
    });
    setOpenItem(2);
  };

  const closeSubmenu = () => {
    setSubmenu({ anchorEl: null, category: null });
    setOpenItem(1);
  };

  return (
    <>
      <List component="nav" dense disablePadding aria-labelledby="category-list">
        {categories.map((category) => {
          const hasChildren = category.children.length > 0;
          return (
            <ListItemButton
              key={category.id}
              component={hasChildren ? 'div' : Link}
              href={hasChildren ? undefined : '#'}
              onMouseEnter={(event) => {
                if (hasChildren) openSubmenu(event, category);
              }}
              onClick={(event) => {
                if (hasChildren) {
                  openSubmenu(event, category);
                  return;
                }
                setOpenItem(0);
              }}
              sx={{
                borderRadius: 0,
                backgroundImage: 'none',
              }}
            >
              <ListItemText primary={category.name} />

              {hasChildren && (
                <IconifyIcon
                  icon="material-symbols-light:keyboard-arrow-right"
                  sx={{ fontSize: 20 }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>
      <Popover
        open={Boolean(submenu.anchorEl && submenu.category)}
        anchorEl={submenu.anchorEl}
        onClose={closeSubmenu}
        container={submenu.anchorEl}
        hideBackdrop
        anchorOrigin={
          upMd
            ? {
                vertical: 'top',
                horizontal: direction === 'rtl' ? 'left' : 'right',
              }
            : {
                vertical: 'top',
                horizontal: direction === 'rtl' ? 'right' : 'left',
              }
        }
        transformOrigin={{
          vertical: 'top',
          horizontal: direction === 'rtl' ? 'right' : 'left',
        }}
        slotProps={{
          paper: {
              sx: [
              openItem > 2 && {
                borderRadius: 0,
              },
              openItem === 2 && {
                borderRadius: '0 8px 8px 0',
              },
            ],
          },
        }}
        sx={[
          {
            position: { xs: 'absolute', md: 'fixed' },
            pointerEvents: 'none',
            [`& .${popoverClasses.paper}`]: {
              pointerEvents: 'auto',
              boxShadow: (theme) => theme.vars.shadows[3],
            },
          },
          downMd && {
            [`& .${popoverClasses.paper}`]: {
              height: '100%',
              width: '100%',
              maxHeight: '100%',
              maxWidth: '100%',
              top: `0 !important`,
              left: '0 !important',
              bottom: '0 !important',
              right: '0 !important',
            },
          },
        ]}
      >
        <Box
          sx={{
            overflow: 'hidden',
            py: 2,
          }}
        >
          <Stack
            sx={{
              justifyContent: 'space-between',
              mb: 3,
              px: 2,
            }}
          >
            <Button
              shape="circle"
              variant="soft"
              color="neutral"
              onClick={closeSubmenu}
            >
              <IconifyIcon icon="material-symbols:arrow-back-rounded" sx={{ fontSize: 20 }} />
            </Button>
            <Button
              shape="circle"
              variant="soft"
              color="neutral"
              onClick={closeSubmenu}
            >
              <IconifyIcon icon="material-symbols:close-rounded" sx={{ fontSize: 20 }} />
            </Button>
          </Stack>
          <SimpleBar disableHorizontal sx={{ height: '100%' }}>
            <List component="nav" dense disablePadding aria-labelledby="category-submenu">
              <ListItemButton
                component={Link}
                href="#"
                onClick={() => {
                  setOpenItem(0);
                }}
                sx={{ borderRadius: 0, backgroundImage: 'none' }}
              >
                <ListItemText primary={`All ${submenu.category?.name ?? ''}`.trim()} />
              </ListItemButton>
              {submenu.category?.children.map((child) => (
                <ListItemButton
                  key={child.id}
                  component={Link}
                  href="#"
                  onClick={() => {
                    setOpenItem(0);
                  }}
                  sx={{ borderRadius: 0, backgroundImage: 'none' }}
                >
                  <ListItemText primary={child.name} />
                </ListItemButton>
              ))}
            </List>
          </SimpleBar>
        </Box>
      </Popover>
    </>
  );
};

const CategoryPopover = ({
  anchorEl,
  categories,
  openItem,
  setOpenItem,
  handleClose,
}: CategoryPopoverProps) => {
  const ref = useRef(null);
  const { direction } = useTheme();

  return (
    <Popover
      open={!!anchorEl && openItem >= 1}
      anchorEl={anchorEl}
      onClose={handleClose}
      anchorOrigin={{
        vertical: 50,
        horizontal: direction === 'rtl' ? 'right' : 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: direction === 'rtl' ? 'right' : 'left',
      }}
      slotProps={{
        paper: {
          sx: [
            openItem > 1 && {
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
            },
          ],
        },
      }}
      sx={{
        [`& .${popoverClasses.paper}`]: {
          boxShadow: (theme) => theme.vars.shadows[3],
          minWidth: 360,
          height: '80vh',
        },
      }}
    >
      <Box
        ref={ref}
        sx={{
          overflow: 'hidden',
          py: 2,
        }}
      >
        <Stack
          sx={{
            justifyContent: 'space-between',
            mb: 3,
            px: 2,
          }}
        >
          <Typography
            variant="body1"
            sx={{
              fontWeight: 700,
            }}
          >
            Category
          </Typography>

          <Button
            shape="circle"
            variant="soft"
            color="neutral"
            onClick={() => {
              setOpenItem(0);
            }}
          >
            <IconifyIcon icon="material-symbols:close-rounded" sx={{ fontSize: 20 }} />
          </Button>
        </Stack>
        <SimpleBar disableHorizontal sx={{ height: '100%' }}>
          <CategoryList categories={categories} setOpenItem={setOpenItem} />
        </SimpleBar>
      </Box>
    </Popover>
  );
};

export default CategoryPopover;
