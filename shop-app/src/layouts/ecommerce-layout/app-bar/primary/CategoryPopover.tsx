import React, { useEffect, useRef, useState } from 'react';
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
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import SimpleBar from 'components/base/SimpleBar';

interface CategoryPopoverProps {
  anchorEl: HTMLButtonElement | null;
  handleClose: () => void;
  openItem: number;
  setOpenItem: React.Dispatch<React.SetStateAction<number>>;
}

type CategoryNode = {
  id: number;
  name: string;
  parentId: number | null;
  order: number;
  children: CategoryNode[];
};

type FlatCategory = {
  id: number;
  name: string;
  depth: number;
};

function flattenTree(nodes: CategoryNode[], depth = 0): FlatCategory[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenTree(Array.isArray(node.children) ? node.children : [], depth + 1),
  ]);
}

const CategoryPopover = ({
  anchorEl,
  openItem,
  setOpenItem,
  handleClose,
}: CategoryPopoverProps) => {
  const ref = useRef(null);
  const [categories, setCategories] = useState<FlatCategory[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/shop/categories');
        const data = (await res.json()) as { tree?: CategoryNode[] };
        if (cancelled) return;
        setCategories(flattenTree(Array.isArray(data.tree) ? data.tree : []));
      } catch { /* best effort */ }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <Popover
      open={!!anchorEl && openItem >= 1}
      anchorEl={anchorEl}
      onClose={handleClose}
      anchorOrigin={{
        vertical: 50,
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      sx={{
        [`& .${popoverClasses.paper}`]: {
          boxShadow: (theme) => theme.vars.shadows[3],
          minWidth: 320,
          maxHeight: '70vh',
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
            mb: 2,
            px: 2,
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            Category
          </Typography>
          <Button
            shape="circle"
            variant="soft"
            color="neutral"
            onClick={() => setOpenItem(0)}
          >
            <IconifyIcon icon="material-symbols:close-rounded" sx={{ fontSize: 20 }} />
          </Button>
        </Stack>
        <SimpleBar disableHorizontal sx={{ maxHeight: '60vh' }}>
          <List dense disablePadding>
            {categories.map((cat) => (
              <ListItemButton
                key={cat.id}
                component={Link}
                href="#"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  setOpenItem(0);
                }}
                sx={{
                  pl: 2 + cat.depth * 2.5,
                  borderRadius: 0,
                  backgroundImage: 'none',
                }}
              >
                <ListItemText
                  primary={cat.name}
                  primaryTypographyProps={{
                    fontWeight: cat.depth === 0 ? 600 : 400,
                    fontSize: cat.depth === 0 ? 14 : 13,
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </SimpleBar>
      </Box>
    </Popover>
  );
};

export default CategoryPopover;
