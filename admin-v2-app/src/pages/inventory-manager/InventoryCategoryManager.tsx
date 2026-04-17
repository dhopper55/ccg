import { useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import IconifyIcon from 'components/base/IconifyIcon';

type InventoryCategoryRecord = {
  id: number;
  name: string;
  parent_id: number | null;
  order: number;
};

type InventoryCategoryNode = {
  id: number;
  name: string;
  parentId: number | null;
  order: number;
  depth: number;
  path: string;
  children: InventoryCategoryNode[];
};

type CategoriesResponse = {
  records?: InventoryCategoryRecord[];
  tree?: InventoryCategoryNode[];
  message?: string;
};

type CategoryFormState = {
  id: number | null;
  name: string;
  parentId: string;
  order: string;
};

const DEFAULT_FORM: CategoryFormState = {
  id: null,
  name: '',
  parentId: '',
  order: '0',
};

const flattenCategoryTree = (nodes: InventoryCategoryNode[]): InventoryCategoryNode[] =>
  nodes.flatMap((node) => [node, ...flattenCategoryTree(node.children || [])]);

const InventoryCategoryManager = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [records, setRecords] = useState<InventoryCategoryRecord[]>([]);
  const [tree, setTree] = useState<InventoryCategoryNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CategoryFormState>(DEFAULT_FORM);
  const [deleteTarget, setDeleteTarget] = useState<InventoryCategoryNode | null>(null);

  const flatCategories = useMemo(() => flattenCategoryTree(tree), [tree]);

  useEffect(() => {
    document.title = 'CCG Admin | Category Manager';
  }, []);

  const loadCategories = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/admin-v2/inventory/categories', {
        method: 'GET',
        credentials: 'same-origin',
      });
      const data = (await response.json()) as CategoriesResponse;
      if (!response.ok) throw new Error(data.message || 'Unable to load categories.');
      setRecords(Array.isArray(data.records) ? data.records : []);
      setTree(Array.isArray(data.tree) ? data.tree : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load categories.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const openCreateDialog = (parentId?: number | null) => {
    setForm({
      ...DEFAULT_FORM,
      parentId: parentId ? String(parentId) : '',
      order: '0',
    });
    setFormOpen(true);
  };

  const openEditDialog = (node: InventoryCategoryNode) => {
    setForm({
      id: node.id,
      name: node.name,
      parentId: node.parentId == null ? '' : String(node.parentId),
      order: String(node.order || 0),
    });
    setFormOpen(true);
  };

  const availableParents = useMemo(
    () => flatCategories.filter((node) => node.id !== form.id),
    [flatCategories, form.id],
  );

  const handleSave = async () => {
    const name = form.name.trim();
    const order = Number.parseInt(form.order, 10);
    if (!name) {
      setErrorMessage('Category name is required.');
      return;
    }
    if (!Number.isFinite(order)) {
      setErrorMessage('Order must be a whole number.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      const endpoint = form.id
        ? `/api/admin-v2/inventory/categories/${encodeURIComponent(String(form.id))}/update`
        : '/api/admin-v2/inventory/categories';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name,
          parentId: form.parentId || null,
          order,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to save category.');
      enqueueSnackbar(form.id ? 'Category updated.' : 'Category added.', { variant: 'success' });
      setFormOpen(false);
      setForm(DEFAULT_FORM);
      await loadCategories();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to save category.';
      setErrorMessage(text);
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    setErrorMessage('');
    try {
      const response = await fetch(
        `/api/admin-v2/inventory/categories/${encodeURIComponent(String(deleteTarget.id))}/delete`,
        {
          method: 'POST',
          credentials: 'same-origin',
        },
      );
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) throw new Error(data.message || 'Unable to delete category.');
      enqueueSnackbar('Category deleted.', { variant: 'success' });
      setDeleteTarget(null);
      await loadCategories();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to delete category.';
      setErrorMessage(text);
      enqueueSnackbar(text, { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack direction="column" height={1} gap={3} sx={{ minWidth: 0 }}>
      <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{
            gap: 2,
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h4">Category Manager</Typography>
          <Tooltip title="Add">
            <IconButton
              aria-label="Add"
              onClick={() => openCreateDialog(null)}
              color="success"
              sx={{
                width: 40,
                height: 40,
                border: 1,
                borderColor: 'success.main',
                bgcolor: 'success.main',
                color: 'common.white',
                '&:hover': {
                  bgcolor: 'success.dark',
                },
              }}
            >
              <IconifyIcon icon="material-symbols:add-rounded" fontSize={20} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Box
        sx={{
          flex: 1,
          px: { xs: 2, md: 5 },
          pb: { xs: 2, md: 5 },
          pt: { xs: 1, md: 1.5 },
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <Stack direction="column" spacing={3}>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper' }}>
            {isLoading ? (
              <Stack sx={{ alignItems: 'center', py: 8 }} spacing={2}>
                <CircularProgress size={28} />
                <Typography sx={{ color: 'text.secondary' }}>Loading categories...</Typography>
              </Stack>
            ) : flatCategories.length === 0 ? (
              <Stack sx={{ alignItems: 'center', py: 8 }} spacing={2}>
                <IconifyIcon icon="material-symbols:data-table-outline-rounded" fontSize={40} />
                <Typography sx={{ color: 'text.secondary' }}>No categories yet.</Typography>
                <Button variant="contained" onClick={() => openCreateDialog(null)}>
                  Add Category
                </Button>
              </Stack>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Parent</TableCell>
                      <TableCell align="right">Order</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {flatCategories.map((node) => (
                      <TableRow key={node.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Box sx={{ width: Math.max(0, node.depth - 1) * 18, flexShrink: 0 }} />
                            {node.depth > 1 ? (
                              <IconifyIcon icon="material-symbols:subdirectory-arrow-right-rounded" fontSize={18} />
                            ) : null}
                            <Box>
                              <Typography variant="subtitle2">{node.name}</Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {node.path}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          {node.parentId == null
                            ? 'Top level'
                            : records.find((record) => record.id === node.parentId)?.name || 'Unknown'}
                        </TableCell>
                        <TableCell align="right">{node.order || 0}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Add child">
                            <IconButton color="primary" onClick={() => openCreateDialog(node.id)}>
                              <IconifyIcon icon="material-symbols:add-rounded" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton color="inherit" onClick={() => openEditDialog(node)}>
                              <IconifyIcon icon="material-symbols:edit-outline-rounded" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton color="error" onClick={() => setDeleteTarget(node)}>
                              <IconifyIcon icon="material-symbols:delete-outline-rounded" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Stack>
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{form.id ? 'Edit Category' : 'Add Category'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                inputProps={{ maxLength: 120 }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                select
                fullWidth
                label="Parent"
                value={form.parentId}
                onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}
              >
                <MenuItem value="">
                  <em>Top level</em>
                </MenuItem>
                {availableParents.map((node) => (
                  <MenuItem key={node.id} value={node.id}>
                    {node.path}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Order"
                type="number"
                value={form.order}
                onChange={(event) => setForm((current) => ({ ...current, order: event.target.value }))}
                inputProps={{ step: 1 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setFormOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={isSaving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete Category?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete {deleteTarget?.name || 'this category'}? Categories can only be deleted when no
            inventory items or child categories use them.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleteTarget(null)} disabled={isSaving}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={isSaving}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default InventoryCategoryManager;
