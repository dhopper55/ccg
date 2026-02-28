import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  ChipOwnProps,
  IconButton,
  Link,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import IconifyIcon from 'components/base/IconifyIcon';
import DataGridPagination from 'components/pagination/DataGridPagination';

type ListingListItem = {
  id: string;
  url?: string;
  source?: string;
  status?: string;
  title?: string;
  askingPrice?: number | string;
  imageUrl?: string | null;
};

type ListingsResponse = {
  records: ListingListItem[];
  message?: string;
};

type ListingGridRow = {
  id: string;
  title: string;
  url?: string;
  sourceLabel: string;
  sourceImageSrc: string | null;
  statusLabel: string;
  statusColor: ChipOwnProps['color'];
  askingPriceLabel: string;
  imageSrc: string | null;
};

const PAGE_SIZE = 20;
const DEFAULT_PAGE_SIZE = 8;

const headerActions = [
  { label: 'Back', icon: 'material-symbols:arrow-back-rounded', color: 'default' as const },
  {
    label: 'Saved Results',
    icon: 'material-symbols:bookmark-outline-rounded',
    color: 'primary' as const,
  },
  {
    label: 'Archived Results',
    icon: 'material-symbols:archive-outline-rounded',
    color: 'error' as const,
  },
  { label: 'Refresh', icon: 'material-symbols:refresh-rounded', color: 'success' as const },
  { label: 'Map', icon: 'material-symbols:map-outline-rounded', color: 'default' as const },
];

function formatCurrencyValue(value: number | string | undefined): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (trimmed.includes('$')) return trimmed;

  const numeric = Number.parseFloat(trimmed.replace(/[^0-9.]/g, ''));
  if (Number.isFinite(numeric)) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(numeric);
  }

  return trimmed;
}

function buildImageSrc(imageUrl?: string | null, referrer?: string): string | null {
  if (!imageUrl) return null;
  const cleaned = imageUrl.trim().split(/\s+/)[0];
  if (!cleaned) return null;

  const normalized = cleaned.toLowerCase();
  if (
    normalized.includes('fbcdn.net') ||
    normalized.includes('scontent-') ||
    normalized.includes('scontent.')
  ) {
    const params = new URLSearchParams();
    params.set('url', cleaned);
    if (referrer) params.set('ref', referrer);
    return `/api/image?${params.toString()}`;
  }

  return cleaned;
}

function buildSourceMeta(source?: string): { label: string; imageSrc: string | null } {
  const normalized = source?.trim().toLowerCase() || '';
  if (normalized === 'facebook' || normalized === 'fbm' || normalized.includes('facebook')) {
    return { label: 'FBM', imageSrc: '/images/fb.png' };
  }
  if (normalized === 'craigslist' || normalized === 'cg' || normalized.includes('craigslist')) {
    return { label: 'CL', imageSrc: '/images/cl.png' };
  }
  return { label: source?.trim() || 'Unknown', imageSrc: null };
}

function buildStatusColor(status?: string): ChipOwnProps['color'] {
  const normalized = status?.trim().toLowerCase() || '';
  if (normalized === 'complete' || normalized === 'completed') return 'success';
  if (normalized === 'failed' || normalized === 'error') return 'error';
  if (normalized === 'queued' || normalized === 'processing') return 'warning';
  return 'neutral';
}

function buildDisplayTitle(record: ListingListItem): string {
  return record.title?.trim() || record.url?.replace(/^https?:\/\//i, '') || 'Untitled listing';
}

const ListingEvaluatorResults = () => {
  const [records, setRecords] = useState<ListingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    document.title = 'CCG Admin | Listing Evaluator Results';
  }, []);

  const loadListings = async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      const response = await fetch(`/api/listings?${params.toString()}`, {
        method: 'GET',
        credentials: 'same-origin',
      });
      const data = (await response.json()) as ListingsResponse;

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load listing evaluator results.');
      }

      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load listing evaluator results.',
      );
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadListings();
  }, []);

  const rows = useMemo<ListingGridRow[]>(
    () =>
      records.map((record, index) => {
        const sourceMeta = buildSourceMeta(record.source);
        return {
          id: record.id || record.url || `${index}`,
          title: buildDisplayTitle(record),
          url: record.url,
          sourceLabel: sourceMeta.label,
          sourceImageSrc: sourceMeta.imageSrc,
          statusLabel: record.status?.trim() || 'unknown',
          statusColor: buildStatusColor(record.status),
          askingPriceLabel: formatCurrencyValue(record.askingPrice),
          imageSrc: buildImageSrc(record.imageUrl, record.url),
        };
      }),
    [records],
  );

  const columns = useMemo<GridColDef<ListingGridRow>[]>(
    () => [
      {
        field: 'title',
        headerName: 'Title',
        sortable: false,
        filterable: false,
        minWidth: 480,
        flex: 1,
        renderCell: (params) => (
          <Stack sx={{ gap: 2, alignItems: 'center', minWidth: 0 }}>
            <Avatar
              variant="rounded"
              src={params.row.imageSrc || undefined}
              alt={params.row.title}
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2.5,
                bgcolor: 'background.elevation1',
                flexShrink: 0,
              }}
            >
              <IconifyIcon icon="material-symbols:image-outline-rounded" />
            </Avatar>

            <Box sx={{ minWidth: 0 }}>
              <Link
                underline="none"
                color="text.primary"
                href={params.row.url || '#'}
                target="_blank"
                rel="noreferrer"
                sx={{
                  display: 'block',
                  fontWeight: 500,
                  fontSize: 'subtitle2.fontSize',
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {params.row.title}
              </Link>

              <Stack sx={{ mt: 0.75, gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                {params.row.askingPriceLabel && (
                  <Chip
                    label={params.row.askingPriceLabel}
                    size="small"
                    color="primary"
                    variant="soft"
                  />
                )}
                <Chip
                  label={params.row.statusLabel}
                  size="small"
                  color={params.row.statusColor}
                  variant="soft"
                  sx={{ textTransform: 'capitalize' }}
                />
              </Stack>
            </Box>
          </Stack>
        ),
      },
      {
        field: 'sourceLabel',
        headerName: 'Source',
        sortable: false,
        filterable: false,
        minWidth: 120,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params) =>
          params.row.sourceImageSrc ? (
            <Avatar
              variant="rounded"
              src={params.row.sourceImageSrc}
              alt={params.row.sourceLabel}
              sx={{
                width: 36,
                height: 36,
                bgcolor: 'background.elevation1',
                '& img': {
                  objectFit: 'contain',
                  width: 22,
                  height: 22,
                },
              }}
            />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {params.row.sourceLabel}
            </Typography>
          ),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        sortable: false,
        filterable: false,
        minWidth: 140,
        align: 'right',
        headerAlign: 'right',
        renderCell: () => (
          <Tooltip title="Inv. Add">
            <IconButton
              aria-label="Inv. Add"
              color="primary"
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2.5,
                bgcolor: 'background.elevation1',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <IconifyIcon icon="material-symbols:add-rounded" fontSize={18} />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [],
  );

  return (
    <Stack direction="column" height={1} gap={3}>
      <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
        <Stack
          sx={{
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h4">Listing Evaluator Results</Typography>

          <Stack sx={{ gap: 1, alignItems: 'center' }}>
            {headerActions.map((action) => (
              <Tooltip key={action.label} title={action.label}>
                <IconButton
                  aria-label={action.label}
                  onClick={() => {
                    if (action.label === 'Refresh') {
                      void loadListings();
                    }
                  }}
                  sx={{
                    width: 40,
                    height: 40,
                    border: 1,
                    borderColor:
                      action.color === 'default' ? 'divider' : `${action.color}.main`,
                    bgcolor:
                      action.color === 'default'
                        ? 'background.elevation1'
                        : `${action.color}.main`,
                    color: action.color === 'default' ? 'text.primary' : 'common.white',
                    '&:hover': {
                      bgcolor:
                        action.color === 'default'
                          ? 'background.elevation2'
                          : `${action.color}.dark`,
                    },
                  }}
                >
                  <IconifyIcon icon={action.icon} fontSize={20} />
                </IconButton>
              </Tooltip>
            ))}
          </Stack>
        </Stack>
      </Paper>

      {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

      <Paper sx={{ flex: 1, p: { xs: 3, md: 5 } }}>
        <DataGrid
          rowHeight={76}
          rows={rows}
          columns={columns}
          loading={isLoading}
          disableRowSelectionOnClick
          pageSizeOptions={[DEFAULT_PAGE_SIZE, PAGE_SIZE]}
          initialState={{
            pagination: {
              paginationModel: {
                pageSize: DEFAULT_PAGE_SIZE,
              },
            },
          }}
          sx={{
            '& .MuiDataGrid-columnHeaders': {
              minWidth: '100%',
            },
          }}
          slots={{
            basePagination: (props) => <DataGridPagination showFullPagination {...props} />,
          }}
        />
      </Paper>
    </Stack>
  );
};

export default ListingEvaluatorResults;
