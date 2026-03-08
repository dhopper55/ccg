import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  useTheme,
} from '@mui/material';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import ReactEchart from 'components/base/ReactEchart';

echarts.use([TooltipComponent, GridComponent, BarChart, CanvasRenderer]);

type SerialDecodeRecord = {
  id: number;
  eventTimeUtc: string | null;
  clientTimestamp: string | null;
  brand: string;
  serial: string;
  success: boolean;
  evaluated: boolean;
  year: string | null;
  factory: string | null;
  country: string | null;
  error: string | null;
};

type SerialDecodesResponse = {
  records: SerialDecodeRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  availableBrands: string[];
  message?: string;
};

type BrandResponsesRecord = {
  brand: string;
  responseCount: number;
};

type BrandResponsesResponse = {
  records: BrandResponsesRecord[];
  message?: string;
};

const PAGE_SIZE = 20;

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) return direct;

  const usDate = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!usDate) return null;

  const month = Number.parseInt(usDate[1], 10) - 1;
  const day = Number.parseInt(usDate[2], 10);
  const year = Number.parseInt(usDate[3], 10);
  const hour = Number.parseInt(usDate[4] || '0', 10);
  const minute = Number.parseInt(usDate[5] || '0', 10);
  const second = Number.parseInt(usDate[6] || '0', 10);
  const parsed = new Date(year, month, day, hour, minute, second);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatTimestampMountain(clientTimestamp: string | null, eventTimeUtc: string | null): string {
  const parsed = parseTimestamp(clientTimestamp) || parseTimestamp(eventTimeUtc);
  if (!parsed) return '-';

  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);

  return formatted.replace(',', '');
}

function formatBrandName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '-';
  return normalized.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

function truncateBrandLabel(value: string, max = 13): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 2))}..`;
}

const SerialDecodes = () => {
  const theme = useTheme();
  const [records, setRecords] = useState<SerialDecodeRecord[]>([]);
  const [brandResponses, setBrandResponses] = useState<BrandResponsesRecord[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [timestampSortDir, setTimestampSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [chartErrorMessage, setChartErrorMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<SerialDecodeRecord | null>(null);
  const [updatingEvaluatedIds, setUpdatingEvaluatedIds] = useState<number[]>([]);

  useEffect(() => {
    document.title = 'CCG Admin | Serial Decodes';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBrandResponses = async () => {
      try {
        setChartErrorMessage('');
        const params = new URLSearchParams();
        if (selectedBrand) params.set('brand', selectedBrand);
        const response = await fetch(`/api/admin-v2/serial-decodes/brand-responses?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
        });
        const data = (await response.json()) as BrandResponsesResponse;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load brand response chart.');
        }
        if (cancelled) return;
        setBrandResponses(Array.isArray(data.records) ? data.records : []);
      } catch (error) {
        if (cancelled) return;
        setBrandResponses([]);
        setChartErrorMessage(error instanceof Error ? error.message : 'Unable to load brand response chart.');
      }
    };

    void loadBrandResponses();

    return () => {
      cancelled = true;
    };
  }, [selectedBrand]);

  useEffect(() => {
    let cancelled = false;

    const loadSerialDecodes = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(PAGE_SIZE));
        params.set('sortDir', timestampSortDir);
        if (selectedBrand) params.set('brand', selectedBrand);
        if (onlyErrors) params.set('onlyErrors', '1');

        const response = await fetch(`/api/admin-v2/serial-decodes?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
        });

        const data = (await response.json()) as SerialDecodesResponse;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load serial decode records.');
        }

        if (cancelled) return;
        setRecords(Array.isArray(data.records) ? data.records : []);
        setAvailableBrands(Array.isArray(data.availableBrands) ? data.availableBrands : []);
        setPage(Math.max(1, Number(data.page || 1)));
        setTotal(Number(data.total || 0));
        setTotalPages(Math.max(1, Number(data.totalPages || 1)));
      } catch (error) {
        if (cancelled) return;
        setRecords([]);
        setAvailableBrands([]);
        setTotal(0);
        setTotalPages(1);
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load serial decode records.',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadSerialDecodes();

    return () => {
      cancelled = true;
    };
  }, [onlyErrors, page, selectedBrand, timestampSortDir]);

  const pageStart = useMemo(() => (page - 1) * PAGE_SIZE + 1, [page]);
  const pageEnd = useMemo(() => Math.min(page * PAGE_SIZE, total), [page, total]);
  const chartRows = useMemo(
    () => brandResponses.filter((item) => item.responseCount > 0).slice(0, 20),
    [brandResponses],
  );
  const chartLabels = useMemo(() => chartRows.map((item) => formatBrandName(item.brand)), [chartRows]);
  const chartOption = useMemo(() => ({
    color: ['#4cc9f0'],
    grid: { left: 56, right: 20, top: 10, bottom: 10, containLabel: false },
    xAxis: {
      type: 'category',
      data: chartLabels,
      axisLabel: {
        rotate: 90,
        interval: 0,
        margin: 4,
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.7)',
        formatter: (value: string) => truncateBrandLabel(String(value || ''), 13),
      },
      axisLine: {
        lineStyle: { color: 'rgba(255, 255, 255, 0.25)' },
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: 'rgba(255, 255, 255, 0.8)' },
      splitLine: {
        lineStyle: { color: 'rgba(255, 255, 255, 0.12)' },
      },
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ axisValueLabel?: string; value?: number }>) => {
        const point = params?.[0];
        const label = point?.axisValueLabel || '';
        const value = Number(point?.value || 0);
        return `${label}<br/>Responses: ${value}`;
      },
    },
    series: [
      {
        type: 'bar',
        data: chartRows.map((item) => item.responseCount),
        barWidth: '55%',
        itemStyle: {
          color: '#4cc9f0',
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  }), [chartLabels, chartRows]);

  const chartEvents = useMemo(
    () => ({
      click: (params: { dataIndex?: number }) => {
        const index = typeof params?.dataIndex === 'number' ? params.dataIndex : -1;
        if (index < 0 || index >= chartRows.length) return;
        const selected = chartRows[index]?.brand || '';
        if (!selected) return;
        setPage(1);
        setSelectedBrand(selected);
      },
    }),
    [chartRows],
  );

  const handleEvaluatedToggle = async (recordId: number, nextValue: boolean) => {
    setUpdatingEvaluatedIds((current) => [...current, recordId]);
    try {
      const response = await fetch(`/api/admin-v2/serial-decodes/${recordId}/evaluated`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ evaluated: nextValue }),
      });

      const data = (await response.json()) as { evaluated?: boolean; message?: string };
      if (!response.ok) {
        throw new Error(data.message || `Unable to update evaluated state (HTTP ${response.status}).`);
      }

      setRecords((current) => current.map((row) => (
        row.id === recordId ? { ...row, evaluated: Boolean(data.evaluated) } : row
      )));
      setSelectedRecord((current) => (
        current && current.id === recordId ? { ...current, evaluated: Boolean(data.evaluated) } : current
      ));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update evaluated state.');
    } finally {
      setUpdatingEvaluatedIds((current) => current.filter((id) => id !== recordId));
    }
  };

  return (
    <Stack direction="column" spacing={3} sx={{ width: 1 }}>
      <Paper sx={{ pt: { xs: 2, md: 2.5 }, pb: { xs: 1, md: 1.25 }, px: { xs: 3, md: 4 }, width: 1, display: 'block' }}>
        <Stack spacing={1.5} sx={{ width: 1 }}>
          <Typography variant="h5">Brand Responses</Typography>
          {chartErrorMessage ? <Alert severity="error">{chartErrorMessage}</Alert> : null}
          {chartRows.length > 0 ? (
            <ReactEchart
              echarts={echarts}
              option={chartOption}
              onEvents={chartEvents}
              sx={{ height: 220, width: '100%', minWidth: 0 }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">No brand response data available.</Typography>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 3, md: 4 }, width: 1, display: 'block' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
          mb={3}
        >
          <Typography variant="h4">Serial Decodes</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="serial-decodes-brand-filter-label">Brand</InputLabel>
              <Select
                labelId="serial-decodes-brand-filter-label"
                value={selectedBrand}
                label="Brand"
                onChange={(event) => {
                  setPage(1);
                  setSelectedBrand(String(event.target.value || ''));
                }}
              >
                <MenuItem value="">All brands</MenuItem>
                {availableBrands.map((brand) => (
                  <MenuItem key={brand} value={brand}>
                    {formatBrandName(brand)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              sx={{ mr: 0 }}
              control={
                <Checkbox
                  size="small"
                  checked={onlyErrors}
                  onChange={(event) => {
                    setPage(1);
                    setOnlyErrors(event.target.checked);
                  }}
                />
              }
              label="Only errors"
            />
          </Stack>
        </Stack>

        {errorMessage ? <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert> : null}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active
                    direction={timestampSortDir}
                    onClick={() => {
                      setPage(1);
                      setTimestampSortDir((current) => (current === 'desc' ? 'asc' : 'desc'));
                    }}
                  >
                    Timestamp
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Brand</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Serial</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Success</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Evaluated?</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Stack direction="row" justifyContent="center" py={4}>
                      <CircularProgress size={26} />
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : records.length < 1 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary" py={2}>
                      No serial decode records found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => {
                  const successColor = record.success ? '#9be7b0' : '#ff9f9f';
                  const successBorderColor = record.success ? 'rgba(155, 231, 176, 0.35)' : 'rgba(255, 159, 159, 0.35)';
                  const successBackground = record.success ? 'rgba(155, 231, 176, 0.03)' : 'rgba(255, 159, 159, 0.03)';
                  return (
                    <TableRow
                      key={record.id}
                      hover
                      onClick={() => setSelectedRecord(record)}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: successBackground,
                        '& td': { borderBottom: `1px solid ${successBorderColor} !important` },
                      }}
                    >
                      <TableCell sx={{ color: `${successColor} !important` }}>
                        {formatTimestampMountain(record.clientTimestamp, record.eventTimeUtc)}
                      </TableCell>
                      <TableCell sx={{ color: `${successColor} !important` }}>{formatBrandName(record.brand || '')}</TableCell>
                      <TableCell sx={{ color: `${successColor} !important` }}>{record.serial || '-'}</TableCell>
                      <TableCell sx={{ color: `${successColor} !important` }}>{record.success ? 'Yes' : 'No'}</TableCell>
                      <TableCell sx={{ color: `${successColor} !important` }}>
                        {record.success ? null : (
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Checkbox
                              size="small"
                              checked={Boolean(record.evaluated)}
                              disabled={updatingEvaluatedIds.includes(record.id)}
                              sx={{
                                color: 'rgba(255, 255, 255, 0.45) !important',
                                '&.Mui-checked': {
                                  color: '#4cc9f0 !important',
                                },
                              }}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => {
                                event.stopPropagation();
                                void handleEvaluatedToggle(record.id, event.target.checked);
                              }}
                            />
                            {record.evaluated ? (
                              <Typography variant="caption" sx={{ color: '#4cc9f0' }}>
                                Yes
                              </Typography>
                            ) : null}
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
          <Typography variant="body2" color="text.secondary">
            {total > 0 ? `Showing ${pageStart}-${pageEnd} of ${total}` : 'Showing 0 records'}
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Dialog open={Boolean(selectedRecord)} onClose={() => setSelectedRecord(null)} fullWidth maxWidth="sm">
        <DialogTitle>Serial Decode Details</DialogTitle>
        <DialogContent dividers>
          {selectedRecord ? (
            <Stack spacing={1.25}>
              <Box>
                <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                <Typography variant="body2">
                  {formatTimestampMountain(selectedRecord.clientTimestamp, selectedRecord.eventTimeUtc)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Brand</Typography>
                <Typography variant="body2">{formatBrandName(selectedRecord.brand || '')}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Serial</Typography>
                <Typography variant="body2">{selectedRecord.serial || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Success</Typography>
                <Typography variant="body2">{selectedRecord.success ? 'Yes' : 'No'}</Typography>
              </Box>

              {selectedRecord.success ? (
                <>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Year</Typography>
                    <Typography variant="body2">{selectedRecord.year || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Factory</Typography>
                    <Typography variant="body2">{selectedRecord.factory || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Country</Typography>
                    <Typography variant="body2">{selectedRecord.country || '-'}</Typography>
                  </Box>
                </>
              ) : (
                <Box>
                  <Typography variant="caption" color="text.secondary">Error</Typography>
                  <Typography variant="body2" color="error.light">
                    {selectedRecord.error || 'Unknown decode error'}
                  </Typography>
                </Box>
              )}
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default SerialDecodes;
