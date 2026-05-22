import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import IconifyIcon from 'components/base/IconifyIcon';
import DataGridPagination from 'components/pagination/DataGridPagination';
import PageHeader from 'components/sections/ecommerce/admin/common/PageHeader';
import paths from 'routes/paths';

type MfrOrder = {
  id: number;
  poNumber: string;
  mfrCode: string;
  orderDate: string;
  notes: string;
  lineItemsTotal: number;
  shippingCost: number;
  otherCost: number;
  salesTax: number;
  total: number;
  fileCount: number;
};

type MfrOrderFile = {
  id: string;
  orderId: number;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
  url: string;
};

type NewOrderForm = {
  poNumber: string;
  mfrCode: string;
  orderDate: string;
  notes: string;
  lineItemsTotal: string;
  shippingCost: string;
  otherCost: string;
  salesTax: string;
  total: string;
};

const todayYmd = () => new Date().toISOString().slice(0, 10);

const defaultForm = (): NewOrderForm => ({
  poNumber: '',
  mfrCode: 'DUNLOP',
  orderDate: todayYmd(),
  notes: '',
  lineItemsTotal: '',
  shippingCost: '',
  otherCost: '',
  salesTax: '',
  total: '',
});

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(value) ? value : 0);
}

function formatFileSize(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function parseMoney(value: string): number {
  const parsed = Number(value.replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

const MfrOrders = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [orders, setOrders] = useState<MfrOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<NewOrderForm>(() => defaultForm());
  const [isSaving, setIsSaving] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [filesOrder, setFilesOrder] = useState<MfrOrder | null>(null);
  const [files, setFiles] = useState<MfrOrderFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploadingOrderId, setUploadingOrderId] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const loadOrders = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/admin-v2/mfr-orders', { credentials: 'same-origin' });
      const payload = (await response.json()) as { records?: MfrOrder[]; message?: string };
      if (!response.ok) throw new Error(payload.message || 'Unable to load manufacturer orders.');
      setOrders(payload.records || []);
    } catch (error) {
      setOrders([]);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load manufacturer orders.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'CCG Admin | Mfr. Orders';
    void loadOrders();
  }, []);

  const loadFiles = async (order: MfrOrder) => {
    setFilesOrder(order);
    setFilesOpen(true);
    setFilesLoading(true);
    try {
      const response = await fetch(`/api/admin-v2/mfr-orders/${encodeURIComponent(order.id)}/files`, {
        credentials: 'same-origin',
      });
      const payload = (await response.json()) as { records?: MfrOrderFile[]; message?: string };
      if (!response.ok) throw new Error(payload.message || 'Unable to load files.');
      setFiles(payload.records || []);
    } catch (error) {
      setFiles([]);
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to load files.', { variant: 'error' });
    } finally {
      setFilesLoading(false);
    }
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin-v2/mfr-orders', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Unable to create manufacturer order.');
      enqueueSnackbar('Manufacturer order created.', { variant: 'success' });
      setCreateOpen(false);
      setForm(defaultForm());
      await loadOrders();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to create manufacturer order.', { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (order: MfrOrder, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadingOrderId(order.id);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`/api/admin-v2/mfr-orders/${encodeURIComponent(order.id)}/files`, {
        method: 'POST',
        credentials: 'same-origin',
        body,
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Unable to upload file.');
      enqueueSnackbar('File uploaded.', { variant: 'success' });
      await loadOrders();
      if (filesOpen && filesOrder?.id === order.id) await loadFiles(order);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to upload file.', { variant: 'error' });
    } finally {
      setUploadingOrderId(null);
    }
  };

  const handleDeleteFile = async (file: MfrOrderFile) => {
    if (!window.confirm(`Delete ${file.fileName}?`)) return;
    try {
      const response = await fetch(file.url, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Unable to delete file.');
      enqueueSnackbar('File deleted.', { variant: 'success' });
      if (filesOrder) await loadFiles(filesOrder);
      await loadOrders();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to delete file.', { variant: 'error' });
    }
  };

  const computedTotal = useMemo(
    () => parseMoney(form.lineItemsTotal) + parseMoney(form.shippingCost) + parseMoney(form.otherCost) + parseMoney(form.salesTax),
    [form.lineItemsTotal, form.shippingCost, form.otherCost, form.salesTax],
  );

  const columns: GridColDef<MfrOrder>[] = useMemo(
    () => [
      { field: 'poNumber', headerName: 'PO #', minWidth: 150 },
      { field: 'mfrCode', headerName: 'MFR Code', minWidth: 130 },
      {
        field: 'orderDate',
        headerName: 'Order Date',
        minWidth: 140,
        valueFormatter: (value) => (value ? dayjs(value).format('MMM D, YYYY') : '—'),
      },
      {
        field: 'notes',
        headerName: 'Notes',
        minWidth: 260,
        flex: 1,
        renderCell: (params) => (
          <Typography variant="body2" noWrap title={params.row.notes}>
            {params.row.notes || '—'}
          </Typography>
        ),
      },
      {
        field: 'lineItemsTotal',
        headerName: 'Line Items',
        minWidth: 130,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => formatCurrency(params.row.lineItemsTotal),
      },
      {
        field: 'shippingCost',
        headerName: 'Shipping',
        minWidth: 120,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => formatCurrency(params.row.shippingCost),
      },
      {
        field: 'otherCost',
        headerName: 'Other',
        minWidth: 110,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => formatCurrency(params.row.otherCost),
      },
      {
        field: 'salesTax',
        headerName: 'Sales Tax',
        minWidth: 120,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => formatCurrency(params.row.salesTax),
      },
      {
        field: 'total',
        headerName: 'Total',
        minWidth: 120,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => <strong>{formatCurrency(params.row.total)}</strong>,
      },
      {
        field: 'actions',
        headerName: '',
        sortable: false,
        filterable: false,
        minWidth: 112,
        align: 'right',
        renderCell: (params) => (
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
            <input
              ref={(node) => {
                fileInputRefs.current[params.row.id] = node;
              }}
              type="file"
              hidden
              onChange={(event) => handleUpload(params.row, event)}
            />
            <Tooltip title="Upload file">
              <span>
                <IconButton
                  size="small"
                  disabled={uploadingOrderId === params.row.id}
                  onClick={() => fileInputRefs.current[params.row.id]?.click()}
                >
                  <IconifyIcon icon="material-symbols:cloud-upload" fontSize={20} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={params.row.fileCount > 0 ? 'View files' : 'No files'}>
              <span>
                <IconButton
                  size="small"
                  disabled={params.row.fileCount < 1}
                  onClick={() => loadFiles(params.row)}
                >
                  <IconifyIcon
                    icon={params.row.fileCount > 0 ? 'material-symbols:attachment-rounded' : 'material-symbols:draft-outline-rounded'}
                    fontSize={20}
                  />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [uploadingOrderId, filesOpen, filesOrder],
  );

  return (
    <Stack direction="column" height={1}>
      <PageHeader
        title="Mfr. Orders"
        breadcrumb={[
          { label: 'Home', url: paths.starter },
          { label: 'Order Manager', url: paths.orderManager },
          { label: 'Mfr. Orders', active: true },
        ]}
        actionComponent={
          <Tooltip title="New manufacturer order">
            <IconButton
              color="primary"
              onClick={() => {
                setForm(defaultForm());
                setCreateOpen(true);
              }}
            >
              <IconifyIcon icon="material-symbols:add-rounded" fontSize={24} />
            </IconButton>
          </Tooltip>
        }
      />
      <Paper sx={{ flex: 1, p: { xs: 3, md: 5 } }}>
        <Stack direction="column" sx={{ gap: 3 }}>
          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          <Box sx={{ width: 1 }}>
            <DataGrid
              rowHeight={64}
              rows={orders}
              columns={columns}
              loading={isLoading}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
              }}
              slots={{
                basePagination: (props) => <DataGridPagination showFullPagination {...props} />,
              }}
            />
          </Box>
        </Stack>
      </Paper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>New Manufacturer Order</DialogTitle>
        <DialogContent>
          <Stack direction="column" sx={{ gap: 2.5, pt: 1 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2 }}>
              <TextField
                label="PO Number"
                value={form.poNumber}
                onChange={(event) => setForm((prev) => ({ ...prev, poNumber: event.target.value.slice(0, 50) }))}
                inputProps={{ maxLength: 50 }}
                fullWidth
              />
              <TextField
                select
                label="MFR Code"
                value={form.mfrCode}
                onChange={(event) => setForm((prev) => ({ ...prev, mfrCode: event.target.value }))}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="DUNLOP">DUNLOP</MenuItem>
              </TextField>
              <TextField
                label="Order Date"
                type="date"
                value={form.orderDate}
                onChange={(event) => setForm((prev) => ({ ...prev, orderDate: event.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 180 }}
              />
            </Stack>
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              multiline
              minRows={4}
              fullWidth
            />
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2, flexWrap: 'wrap' }}>
              {([
                ['lineItemsTotal', 'Line Items Total'],
                ['shippingCost', 'Shipping Cost'],
                ['otherCost', 'Other Cost'],
                ['salesTax', 'Sales Tax'],
                ['total', 'Total'],
              ] as const).map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  type="number"
                  value={key === 'total' && !form.total ? computedTotal.toFixed(2) : form[key]}
                  onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                  inputProps={{ min: 0, step: 0.01 }}
                  sx={{ minWidth: 160 }}
                />
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={isSaving || !form.poNumber.trim()} onClick={handleCreate}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={filesOpen} onClose={() => setFilesOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{filesOrder ? `Files for ${filesOrder.poNumber}` : 'Files'}</DialogTitle>
        <DialogContent>
          <Stack direction="column" sx={{ gap: 1.5, pt: 1 }}>
            {filesLoading ? (
              <Typography sx={{ color: 'text.secondary' }}>Loading files...</Typography>
            ) : files.length === 0 ? (
              <Typography sx={{ color: 'text.secondary' }}>No files uploaded.</Typography>
            ) : (
              files.map((file) => (
                <Paper key={file.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Link href={file.url} target="_blank" rel="noreferrer" variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {file.fileName}
                      </Link>
                      <Typography variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                        {formatFileSize(file.fileSize)}
                        {file.uploadedAt ? ` · ${dayjs(file.uploadedAt).format('MMM D, YYYY h:mm A')}` : ''}
                      </Typography>
                    </Box>
                    <Tooltip title="Delete file">
                      <IconButton color="error" size="small" onClick={() => handleDeleteFile(file)}>
                        <IconifyIcon icon="material-symbols:delete-outline-rounded" fontSize={20} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Paper>
              ))
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilesOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default MfrOrders;
