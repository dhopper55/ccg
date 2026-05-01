import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  ChipOwnProps,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  InputAdornment,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import dayjs from 'dayjs';
import paths from 'routes/paths';
import IconifyIcon from 'components/base/IconifyIcon';
import DataGridPagination from 'components/pagination/DataGridPagination';
import PageHeader from 'components/sections/ecommerce/admin/common/PageHeader';
import StyledTextField from 'components/styled/StyledTextField';

type StripePaymentLink = {
  id: string;
  name: string;
  price: string;
  created: number;
  createdLabel: string;
  status: 'Active' | 'Deactivated';
  automaticTax: boolean;
  url: string;
};

type PaymentLinksResponse = {
  records?: StripePaymentLink[];
  message?: string;
};

type MarkedInventoryItem = {
  id: string;
  ccgNumber: string;
  title: string;
  price: string;
  quantity: number;
  brand: string;
  category: string;
  forSale: boolean;
  isSold: boolean;
};

type MarkedItemsResponse = {
  records?: MarkedInventoryItem[];
  maxItems?: number;
  message?: string;
};

const getStatusBadgeColor = (value: StripePaymentLink['status']): ChipOwnProps['color'] =>
  value === 'Active' ? 'success' : 'neutral';

const PaymentLinks = () => {
  const [paymentLinks, setPaymentLinks] = useState<StripePaymentLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [markedItems, setMarkedItems] = useState<MarkedInventoryItem[]>([]);
  const [maxMarkedItems, setMaxMarkedItems] = useState(20);
  const [isLoadingMarkedItems, setIsLoadingMarkedItems] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [includeSalesTax, setIncludeSalesTax] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadPaymentLinks = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch('/api/admin-v2/payment-links', { credentials: 'same-origin' });
        const payload = (await response.json()) as PaymentLinksResponse;
        if (!response.ok) throw new Error(payload.message || 'Unable to load payment links.');
        if (!cancelled) setPaymentLinks(payload.records || []);
      } catch (loadError) {
        if (!cancelled) {
          setPaymentLinks([]);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load payment links.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void loadPaymentLinks();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPaymentLinks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return paymentLinks;
    return paymentLinks.filter((paymentLink) =>
      [
        paymentLink.name,
        paymentLink.price,
        paymentLink.status,
        paymentLink.createdLabel,
        paymentLink.url,
      ].some((value) => value.toLowerCase().includes(term)),
    );
  }, [paymentLinks, search]);

  const columns: GridColDef<StripePaymentLink>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        minWidth: 420,
        flex: 1,
        renderCell: (params) => (
          <Stack sx={{ minWidth: 0, justifyContent: 'center' }}>
            <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', minWidth: 0 }}>
              <Link
                href={params.row.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="subtitle2"
                sx={{ fontWeight: 700, lineHeight: 1.25 }}
              >
                {params.row.name || params.row.id}
              </Link>
              <Chip
                label={params.row.status}
                variant="soft"
                color={getStatusBadgeColor(params.row.status)}
                size="small"
              />
            </Stack>
          </Stack>
        ),
      },
      {
        field: 'price',
        headerName: 'Price',
        minWidth: 220,
        renderCell: (params) => (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.row.price || '—'}
          </Typography>
        ),
      },
      {
        field: 'created',
        headerName: 'Created',
        minWidth: 180,
        valueFormatter: (value) => (value ? dayjs.unix(Number(value)).format('MMM D, h:mm A') : '—'),
      },
    ],
    [],
  );

  const openCreateDialog = async () => {
    setCreateDialogOpen(true);
    setCreateError('');
    setIncludeSalesTax(true);
    setIsLoadingMarkedItems(true);
    try {
      const response = await fetch('/api/admin-v2/payment-links/marked-items', {
        credentials: 'same-origin',
      });
      const payload = (await response.json()) as MarkedItemsResponse;
      if (!response.ok) throw new Error(payload.message || 'Unable to load marked inventory.');
      setMarkedItems(payload.records || []);
      setMaxMarkedItems(payload.maxItems || 20);
    } catch (loadError) {
      setMarkedItems([]);
      setCreateError(loadError instanceof Error ? loadError.message : 'Unable to load marked inventory.');
    } finally {
      setIsLoadingMarkedItems(false);
    }
  };

  const handleCreatePaymentLink = async () => {
    setIsCreating(true);
    setCreateError('');
    try {
      const response = await fetch('/api/admin-v2/payment-links', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeSalesTax }),
      });
      const payload = (await response.json()) as PaymentLinksResponse;
      if (!response.ok) throw new Error(payload.message || 'Unable to create payment link.');
      if (payload.records) setPaymentLinks(payload.records);
      setCreateDialogOpen(false);
    } catch (createLinkError) {
      setCreateError(
        createLinkError instanceof Error ? createLinkError.message : 'Unable to create payment link.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const hasMarkedItems = markedItems.length > 0;
  const markedItemLimitExceeded = markedItems.length > maxMarkedItems;

  return (
    <Stack direction="column" height={1}>
      <PageHeader
        title="Payment Links"
        breadcrumb={[
          { label: 'Home', url: paths.starter },
          { label: 'Order Manager', url: paths.orderManager },
          { label: 'Payment Links', active: true },
        ]}
        actionComponent={
          <Button
            variant="contained"
            startIcon={<IconifyIcon icon="material-symbols:add-rounded" />}
            onClick={openCreateDialog}
          >
            Create payment link
          </Button>
        }
      />
      <Paper sx={{ flex: 1, p: { xs: 3, md: 5 } }}>
        <Stack direction="column" sx={{ gap: 4 }}>
          <Stack
            sx={{
              gap: 2,
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { md: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <StyledTextField
              id="payment-link-search-box"
              type="search"
              size="medium"
              placeholder="Search payment links"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconifyIcon icon="material-symbols:search-rounded" sx={{ fontSize: 20 }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ maxWidth: { sm: 360 } }}
            />
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {['Created', 'Status', 'Automatic tax'].map((label) => (
                <Chip
                  key={label}
                  label={label}
                  variant="outlined"
                  icon={<IconifyIcon icon="material-symbols:add-circle-outline-rounded" />}
                  sx={{ borderStyle: 'dashed' }}
                />
              ))}
            </Stack>
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
          <Box sx={{ width: 1 }}>
            <DataGrid
              rowHeight={68}
              rows={filteredPaymentLinks}
              columns={columns}
              loading={isLoading}
              pageSizeOptions={[10]}
              initialState={{
                pagination: {
                  paginationModel: {
                    pageSize: 10,
                  },
                },
              }}
              slots={{
                basePagination: (props) => <DataGridPagination showFullPagination {...props} />,
              }}
            />
          </Box>
        </Stack>
      </Paper>
      <Dialog
        open={createDialogOpen}
        onClose={() => {
          if (!isCreating) setCreateDialogOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Create Payment Link</DialogTitle>
        <DialogContent>
          <Stack direction="column" sx={{ gap: 2, pt: 1 }}>
            {createError && <Alert severity="error">{createError}</Alert>}
            {isLoadingMarkedItems ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Loading marked items...
              </Typography>
            ) : hasMarkedItems ? (
              <>
                <Stack direction="column" divider={<Divider flexItem />} sx={{ gap: 1 }}>
                  {markedItems.map((item) => (
                    <Stack
                      key={item.id}
                      sx={{
                        py: 1,
                        gap: 1,
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { sm: 'center' },
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {[item.ccgNumber, item.brand, item.category].filter(Boolean).join(' • ') || 'Marked item'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {item.price} x {item.quantity || 1}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
                {markedItemLimitExceeded && (
                  <Alert severity="warning">
                    Stripe payment links support up to {maxMarkedItems} line items. Unmark items and try again.
                  </Alert>
                )}
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={includeSalesTax}
                      onChange={(event) => setIncludeSalesTax(event.target.checked)}
                    />
                  }
                  label="Include 7.5% CO Sales Tax"
                />
              </>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                no marked items exist
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="text"
            color="neutral"
            disabled={isCreating}
            onClick={() => setCreateDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!hasMarkedItems || markedItemLimitExceeded || isLoadingMarkedItems || isCreating}
            onClick={handleCreatePaymentLink}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default PaymentLinks;
