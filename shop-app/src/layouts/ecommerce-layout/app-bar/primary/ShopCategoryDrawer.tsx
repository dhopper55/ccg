import { useEffect, useState } from 'react';
import { Box, Button, Drawer, List, ListItemButton, ListItemText, Stack, drawerClasses } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router';
import { slugifyCategory } from 'lib/utils';
import paths from 'routes/paths';
import IconifyIcon from 'components/base/IconifyIcon';

type CategoryNode = {
  id: number;
  name: string;
  children?: CategoryNode[];
};

type ShopCategoriesResponse = {
  tree?: CategoryNode[];
};

interface ShopCategoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

const getCategoryHref = (category: CategoryNode): string =>
  paths.categoryPage(slugifyCategory(category.name));

const CategoryItem = ({
  category,
  depth,
  activeCategory,
  onNavigate,
}: {
  category: CategoryNode;
  depth: number;
  activeCategory: string;
  onNavigate: () => void;
}) => {
  const isActive = Boolean(activeCategory) && slugifyCategory(category.name) === activeCategory;

  return (
    <>
      <ListItemButton
        component={RouterLink}
        to={getCategoryHref(category)}
        onClick={onNavigate}
        selected={isActive}
        sx={{
          pl: 3 + depth * 2.5,
          pr: 3,
          py: 1.25,
          alignItems: 'flex-start',
        }}
      >
        <ListItemText
          primary={category.name}
          primaryTypographyProps={{
            fontWeight: depth === 0 ? 700 : 500,
            fontSize: depth === 0 ? 15 : 14,
          }}
        />
      </ListItemButton>
      {Array.isArray(category.children) &&
        category.children.map((child) => (
          <CategoryItem
            key={child.id}
            category={child}
            depth={depth + 1}
            activeCategory={activeCategory}
            onNavigate={onNavigate}
          />
        ))}
    </>
  );
};

const ShopCategoryDrawer = ({ open, onClose }: ShopCategoryDrawerProps) => {
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [categories, setCategories] = useState<CategoryNode[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/shop/categories');
        const data = (await res.json()) as ShopCategoriesResponse;
        if (!cancelled) {
          setCategories(Array.isArray(data.tree) ? data.tree : []);
        }
      } catch {
        if (!cancelled) {
          setCategories([]);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCategory = categorySlug ?? '';

  return (
    <Drawer
      anchor="left"
      variant="temporary"
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: true,
      }}
      sx={(theme) => ({
        display: { xs: 'block', md: 'none' },
        [`& .${drawerClasses.paper}`]: {
          width: 'min(86vw, 360px)',
          border: 0,
          outline: `1px solid ${theme.vars.palette.divider}`,
          bgcolor: theme.vars.palette.background.default,
        },
      })}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack
          direction="row"
          sx={{
            justifyContent: 'flex-end',
            px: 2,
            pt: 2,
          }}
        >
          <Button shape="circle" variant="soft" color="neutral" onClick={onClose}>
            <IconifyIcon icon="material-symbols:close-rounded" sx={{ fontSize: 20 }} />
          </Button>
        </Stack>
        <Box sx={{ overflowY: 'auto', flex: 1, py: 1 }}>
          <List disablePadding>
            <ListItemButton
              component={RouterLink}
              to={paths.products}
              onClick={onClose}
              selected={!activeCategory}
              sx={{ px: 3, py: 1.25 }}
            >
              <ListItemText
                primary="All gear"
                primaryTypographyProps={{ fontWeight: 700, fontSize: 15 }}
              />
            </ListItemButton>
            {categories.map((category) => (
              <CategoryItem
                key={category.id}
                category={category}
                depth={0}
                activeCategory={activeCategory}
                onNavigate={onClose}
              />
            ))}
          </List>
        </Box>
      </Stack>
    </Drawer>
  );
};

export default ShopCategoryDrawer;
