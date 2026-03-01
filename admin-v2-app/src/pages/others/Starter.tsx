import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { CallbackDataParams } from 'echarts/types/dist/shared';
import IconifyIcon from 'components/base/IconifyIcon';
import ReactEchart from 'components/base/ReactEchart';
import SectionHeader from 'components/common/SectionHeader';

echarts.use([TooltipComponent, GridComponent, LineChart, BarChart, PieChart, CanvasRenderer]);

type DashboardSummaryResponse = {
  asOf: string;
  kpis: {
    inventoryCostBasis: number;
    privatePartyValue: number;
    currentAskingValue: number;
    realizedProfitMTD: number;
    forSaleItems: number;
    avgDaysToSell: number;
    activeItems: number;
    notForSaleItems: number;
    soldItems: number;
    allTimeSoldMarginPercent: number;
  };
};

type ProfitTrendPoint = {
  month: string;
  label: string;
  soldCount: number;
  revenue: number;
  cost: number;
  profit: number;
};

type ProfitTrendResponse = {
  months: number;
  points: ProfitTrendPoint[];
};

type InventoryAgingBucket = {
  key: string;
  label: string;
  itemCount: number;
  costBasis: number;
  privatePartyValue: number;
  currentAskingValue: number;
};

type InventoryAgingResponse = {
  asOf: string;
  buckets: InventoryAgingBucket[];
};

type RecentSaleRow = {
  id: number;
  ccgNumber: string;
  title: string;
  imageUrl: string;
  soldDate: string | null;
  purchasePrice: number;
  soldAmount: number;
  profitAmount: number;
  daysHeld: number | null;
};

type RecentSalesResponse = {
  records: RecentSaleRow[];
};

type OldestInventoryRow = {
  id: number;
  ccgNumber: string;
  title: string;
  imageUrl: string;
  purchasedDate: string | null;
  daysHeld: number | null;
  purchasePrice: number;
  currentAskingValue: number;
  forSale: boolean;
  source: string | null;
};

type OldestInventoryResponse = {
  records: OldestInventoryRow[];
};

type DashboardState = {
  summary: DashboardSummaryResponse | null;
  profitTrend: ProfitTrendResponse | null;
  inventoryAging: InventoryAgingResponse | null;
  recentSales: RecentSaleRow[];
  oldestInventory: OldestInventoryRow[];
};

const initialState: DashboardState = {
  summary: null,
  profitTrend: null,
  inventoryAging: null,
  recentSales: [],
  oldestInventory: [],
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatShortDate(value: string | null): string {
  if (!value) return 'Unknown';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function buildImageSrc(imageUrl?: string | null): string | undefined {
  const trimmed = imageUrl?.trim();
  return trimmed || undefined;
}

function sourceLabel(source: string | null): string {
  const normalized = source?.trim().toLowerCase() || '';
  if (normalized.includes('facebook')) return 'FBM';
  if (normalized.includes('craigslist')) return 'CL';
  return source?.trim() || 'Manual';
}

const MetricMiniCard = ({
  title,
  subTitle,
  value,
  chipLabel,
}: {
  title: string;
  subTitle: string;
  value: string;
  chipLabel?: string;
}) => (
  <Paper sx={{ p: { xs: 3, md: 4 }, height: 1 }}>
    <Stack sx={{ gap: 2, height: 1, justifyContent: 'space-between' }}>
      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
          {subTitle}
        </Typography>
      </Box>
      <Box>
        <Typography sx={{ typography: { xs: 'h4', xl: 'h3' }, mb: 1 }}>{value}</Typography>
        {chipLabel ? <Chip label={chipLabel} color="success" /> : null}
      </Box>
    </Stack>
  </Paper>
);

const Starter = () => {
  const theme = useTheme();
  const [dashboard, setDashboard] = useState<DashboardState>(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    document.title = 'CCG Admin | Home';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [summaryResponse, trendResponse, agingResponse, recentSalesResponse, oldestResponse] =
          await Promise.all([
            fetch('/api/admin-v2/dashboard/summary', { credentials: 'same-origin' }),
            fetch('/api/admin-v2/dashboard/profit-trend?months=12', { credentials: 'same-origin' }),
            fetch('/api/admin-v2/dashboard/inventory-aging', { credentials: 'same-origin' }),
            fetch('/api/admin-v2/dashboard/recent-sales?limit=8', { credentials: 'same-origin' }),
            fetch('/api/admin-v2/dashboard/oldest-inventory?limit=8', { credentials: 'same-origin' }),
          ]);

        const payloads = await Promise.all([
          summaryResponse.json() as Promise<DashboardSummaryResponse>,
          trendResponse.json() as Promise<ProfitTrendResponse>,
          agingResponse.json() as Promise<InventoryAgingResponse>,
          recentSalesResponse.json() as Promise<RecentSalesResponse>,
          oldestResponse.json() as Promise<OldestInventoryResponse>,
        ]);

        if (
          !summaryResponse.ok ||
          !trendResponse.ok ||
          !agingResponse.ok ||
          !recentSalesResponse.ok ||
          !oldestResponse.ok
        ) {
          throw new Error('Unable to load CCG dashboard data.');
        }

        if (!cancelled) {
          setDashboard({
            summary: payloads[0],
            profitTrend: payloads[1],
            inventoryAging: payloads[2],
            recentSales: payloads[3].records || [],
            oldestInventory: payloads[4].records || [],
          });
        }
      } catch (error) {
        if (!cancelled) {
          setDashboard(initialState);
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load dashboard.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const profitTrendOption = useMemo(() => {
    const points = dashboard.profitTrend?.points || [];
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: CallbackDataParams[]) => {
          const point = points[params[0]?.dataIndex ?? 0];
          if (!point) return '';
          return [
            `<strong>${point.label}</strong>`,
            `Profit: ${formatCurrency(point.profit)}`,
            `Revenue: ${formatCurrency(point.revenue)}`,
            `Cost: ${formatCurrency(point.cost)}`,
            `Sold: ${formatNumber(point.soldCount)}`,
          ].join('<br/>');
        },
      },
      xAxis: {
        type: 'category',
        data: points.map((point) => point.label),
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          show: true,
          interval: 0,
          lineStyle: { color: theme.palette.divider },
        },
        axisLabel: { color: theme.palette.text.secondary, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
      },
      grid: { top: 12, right: 16, bottom: 12, left: 16 },
      series: [
        {
          type: 'line',
          data: points.map((point) => point.profit),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 4, color: theme.palette.primary.main },
          areaStyle: { color: 'rgba(87, 143, 246, 0.14)' },
        },
      ],
    };
  }, [dashboard.profitTrend?.points, theme.palette.divider, theme.palette.primary.main, theme.palette.text.secondary]);

  const agingPieOption = useMemo(() => {
    const buckets = dashboard.inventoryAging?.buckets || [];
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: CallbackDataParams) => {
          const bucket = buckets[params.dataIndex ?? 0];
          if (!bucket) return '';
          return [
            `<strong>${bucket.label}</strong>`,
            `Cost basis: ${formatCurrency(bucket.costBasis)}`,
            `Items: ${formatNumber(bucket.itemCount)}`,
          ].join('<br/>');
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['78%', '92%'],
          padAngle: 2,
          label: { show: false },
          itemStyle: { borderColor: 'transparent' },
          emphasis: { scale: false },
          data: buckets.map((bucket, index) => ({
            name: bucket.label,
            value: bucket.costBasis,
            itemStyle: {
              color: [
                theme.palette.primary.main,
                theme.palette.chBlue?.[300] || '#7fb2ff',
                theme.palette.success.main,
                theme.palette.warning.main,
                theme.palette.chGrey?.[400] || '#8b949e',
              ][index] || theme.palette.primary.main,
            },
          })),
        },
      ],
    };
  }, [dashboard.inventoryAging?.buckets, theme.palette]);

  const recentSalesRows = dashboard.recentSales;
  const oldestRows = dashboard.oldestInventory;
  const summary = dashboard.summary?.kpis;
  const totalProfit12m = (dashboard.profitTrend?.points || []).reduce((sum, point) => sum + point.profit, 0);

  return (
    <Box sx={{ minWidth: 0 }}>
      {errorMessage && <Alert severity="error" sx={{ mb: 3 }}>{errorMessage}</Alert>}

      {isLoading && !summary ? (
        <Paper sx={{ p: 5 }}>
          <Stack sx={{ alignItems: 'center', gap: 2 }}>
            <CircularProgress size={28} />
            <Typography sx={{ color: 'text.secondary' }}>Loading dashboard data...</Typography>
          </Stack>
        </Paper>
      ) : (
        <>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 5, lg: 4, xl: 3 }} sx={{ height: 1 }}>
              <Paper sx={{ p: { xs: 3, md: 5 }, height: 1, overflow: 'hidden' }}>
                <Stack direction="column" sx={{ height: 1 }} divider={<Divider flexItem />}>
                  <Box sx={{ pb: 3 }}>
                    <Typography variant="subtitle1" sx={{ color: 'text.secondary', fontWeight: 500, mb: 1 }}>
                      {dashboard.summary?.asOf ? formatShortDate(dashboard.summary.asOf) : 'Today'}
                    </Typography>
                    <Typography variant="h3" sx={{ mb: 2 }}>
                      Good evening, CCG
                    </Typography>
                    <Typography sx={{ color: 'text.secondary' }}>
                      Inventory should move cash, not trap it. Watch margin, speed, and aging.
                    </Typography>
                  </Box>

                  <Box sx={{ py: 3 }}>
                    <Typography variant="subtitle2" color="text.secondary" fontWeight={400} mb={2}>
                      Snapshot
                    </Typography>
                    <Stack sx={{ gap: 2.5 }}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        sx={{ gap: 1.5, alignItems: { xs: 'flex-start', sm: 'center' } }}
                      >
                        <Avatar sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}>
                          <IconifyIcon icon="material-symbols:payments-outline-rounded" />
                        </Avatar>
                        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', alignItems: 'baseline' }}>
                          <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            {formatCurrency(summary?.inventoryCostBasis || 0)}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            Cost basis
                          </Typography>
                        </Stack>
                      </Stack>

                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        sx={{ gap: 1.5, alignItems: { xs: 'flex-start', sm: 'center' } }}
                      >
                        <Avatar sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}>
                          <IconifyIcon icon="material-symbols:storefront-outline-rounded" />
                        </Avatar>
                        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', alignItems: 'baseline' }}>
                          <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            {formatNumber(summary?.forSaleItems || 0)}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            For sale
                          </Typography>
                        </Stack>
                      </Stack>

                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        sx={{ gap: 1.5, alignItems: { xs: 'flex-start', sm: 'center' } }}
                      >
                        <Avatar sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}>
                          <IconifyIcon icon="material-symbols:trending-up-rounded" />
                        </Avatar>
                        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap', alignItems: 'baseline' }}>
                          <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            {formatCurrency(summary?.realizedProfitMTD || 0)}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            Profit MTD
                          </Typography>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Box>

                  <Box sx={{ pt: 3 }}>
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 400, mb: 2 }}>
                      Immediate pressure points
                    </Typography>
                    <Stack sx={{ gap: 1 }}>
                      {oldestRows.slice(0, 4).map((item) => (
                        <Stack
                          key={item.id}
                          direction="row"
                          sx={{
                            py: 1.5,
                            px: 1.5,
                            bgcolor: 'background.elevation2',
                            borderRadius: 2,
                            gap: 1,
                            alignItems: 'center',
                          }}
                        >
                          <Box
                            component="img"
                            src={buildImageSrc(item.imageUrl)}
                            alt={item.title}
                            sx={{ width: 42, height: 42, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
                          />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                              {item.title}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {item.daysHeld != null ? `${item.daysHeld} days held` : 'Unknown age'}
                            </Typography>
                          </Box>
                          <Chip
                            label={item.forSale ? 'For sale' : 'Held'}
                            size="small"
                            variant="soft"
                            color={item.forSale ? 'success' : 'warning'}
                          />
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              </Paper>
            </Grid>

            <Grid container size={{ xs: 12, md: 7, lg: 8, xl: 9 }}>
              <Grid size={{ xs: 12, xl: 6.67 }} order={{ lg: 1 }}>
                <Paper sx={{ p: { xs: 3, md: 5 }, height: 1 }}>
                  <Stack direction="column" sx={{ rowGap: 4, height: '100%' }}>
                    <Grid container spacing={2} sx={{ alignItems: { lg: 'flex-end' }, justifyContent: 'space-between' }}>
                      <Grid size={{ xs: 'grow', lg: 'auto' }}>
                        <Typography variant="h6" sx={{ mb: 1 }}>
                          Profit Trend
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Realized gross profit across the last 12 months
                        </Typography>
                      </Grid>
                      <Grid sx={{ ml: { sm: 'auto', md: 0 } }}>
                        <IconButton size="small" aria-label="Profit trend options">
                          <IconifyIcon icon="material-symbols:more-horiz-rounded" />
                        </IconButton>
                      </Grid>
                      <Grid size={{ xs: 12, lg: 'auto' }}>
                        <Stack sx={{ gap: 1 }}>
                          <Typography sx={{ typography: { xs: 'h4', xl: 'h3' }, mb: 0.5 }}>
                            {formatCurrency(totalProfit12m)}
                          </Typography>
                          <Box>
                            <Chip label={formatPercent(summary?.allTimeSoldMarginPercent || 0)} color="success" />
                            <Typography variant="body2" sx={{ color: 'text.secondary', ml: 0.75, display: 'inline' }}>
                              sold margin
                            </Typography>
                          </Box>
                        </Stack>
                      </Grid>
                    </Grid>

                    <Box sx={{ flex: 1, '& .echarts-for-react': { height: '100% !important' } }}>
                      <ReactEchart echarts={echarts} option={profitTrendOption} sx={{ minHeight: 280, width: '100%' }} />
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              <Grid container size={{ xs: 12, xl: 5.33 }}>
                <Grid size={{ xs: 12, sm: 6, md: 12, lg: 6, xl: 12 }}>
                  <MetricMiniCard
                    title="Private Party Value"
                    subTitle="Expected value of active unsold inventory"
                    value={formatCurrency(summary?.privatePartyValue || 0)}
                    chipLabel={`${formatNumber(summary?.activeItems || 0)} active`}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 12, lg: 6, xl: 12 }}>
                  <MetricMiniCard
                    title="Current Asking Value"
                    subTitle="Current value of items already listed for sale"
                    value={formatCurrency(summary?.currentAskingValue || 0)}
                    chipLabel={`${summary?.avgDaysToSell?.toFixed(1) || '0.0'} avg days`}
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, xl: 8 }}>
              <Paper sx={{ p: { xs: 3, md: 5 }, height: 1 }}>
                <SectionHeader
                  title="Recent Sales"
                  subTitle="Detailed information about recently sold inventory"
                  sx={{ flexWrap: { xs: 'wrap', sm: 'nowrap' }, columnGap: 1, rowGap: 3, mb: 3 }}
                  actionComponent={
                    <IconButton size="small" aria-label="Recent sales options">
                      <IconifyIcon icon="material-symbols:more-horiz-rounded" />
                    </IconButton>
                  }
                />
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '100%' }}>Product</TableCell>
                        <TableCell align="right">Margin</TableCell>
                        <TableCell align="right">Sold</TableCell>
                        <TableCell align="right">Days Held</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentSalesRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', minWidth: 0 }}>
                              <Box
                                component="img"
                                src={buildImageSrc(row.imageUrl)}
                                alt={row.title}
                                sx={{ width: 48, height: 48, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
                              />
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                                  {row.title}
                                </Typography>
                                <Chip
                                  label={row.ccgNumber}
                                  size="small"
                                  variant="soft"
                                  color="primary"
                                  sx={{ mt: 0.5 }}
                                />
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">{formatCurrency(row.profitAmount)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.soldAmount)}</TableCell>
                          <TableCell align="right">{row.daysHeld == null ? '--' : `${row.daysHeld}`}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 6, xl: 4 }}>
              <Paper sx={{ p: { xs: 3, md: 5 }, height: '100%' }}>
                <SectionHeader
                  title="Inventory Aging"
                  subTitle="Amount of tied-up inventory by holding period"
                  actionComponent={
                    <IconButton size="small" aria-label="Inventory aging options">
                      <IconifyIcon icon="material-symbols:more-horiz-rounded" />
                    </IconButton>
                  }
                />
                <Stack
                  direction={{ xs: 'column', sm: 'row', md: 'column' }}
                  sx={{ gap: 4, alignItems: 'center' }}
                >
                  <Stack sx={{ justifyContent: 'center', flex: 1 }}>
                    <Box sx={{ width: 'fit-content', position: 'relative' }}>
                      <ReactEchart echarts={echarts} option={agingPieOption} sx={{ height: '230px !important', width: '230px' }} />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%,-50%)',
                          textAlign: 'center',
                        }}
                      >
                        <Typography variant="h3" sx={{ mb: 1 }}>
                          {formatCurrency(summary?.inventoryCostBasis || 0)}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'regular', color: 'text.secondary' }}>
                          Unsold cost basis
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>

                  <Stack sx={{ width: 1, gap: 1.5 }}>
                    {(dashboard.inventoryAging?.buckets || []).map((bucket) => (
                      <Stack
                        key={bucket.key}
                        direction="row"
                        sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2 }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2">{bucket.label}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {formatNumber(bucket.itemCount)} items
                          </Typography>
                        </Box>
                        <Chip label={formatCurrency(bucket.costBasis)} color="success" variant="soft" />
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 6, xl: 6 }} order={{ xl: 1 }} sx={{ display: 'flex', flexDirection: 'column' }}>
              <Paper sx={{ p: { xs: 3, md: 5 }, height: 1 }}>
                <SectionHeader
                  title="Oldest Inventory"
                  subTitle="Details on the oldest unsold inventory currently holding cash"
                  actionComponent={
                    <Chip
                      label={`${formatNumber(summary?.notForSaleItems || 0)} held back`}
                      color="warning"
                      variant="soft"
                    />
                  }
                  sx={{ flexWrap: { xs: 'wrap', sm: 'nowrap' }, columnGap: 1, rowGap: 2, mb: 3 }}
                />
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: '100%' }}>Product</TableCell>
                        <TableCell>Source</TableCell>
                        <TableCell align="right">Paid</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Days Held</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {oldestRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center', minWidth: 0 }}>
                              <Box
                                component="img"
                                src={buildImageSrc(row.imageUrl)}
                                alt={row.title}
                                sx={{ width: 48, height: 48, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
                              />
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                                  {row.title}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {row.ccgNumber}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>{sourceLabel(row.source)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.purchasePrice)}</TableCell>
                          <TableCell>
                            <Chip
                              label={row.forSale ? 'For sale' : 'Held'}
                              size="small"
                              variant="soft"
                              color={row.forSale ? 'success' : 'warning'}
                            />
                          </TableCell>
                          <TableCell align="right">{row.daysHeld == null ? '--' : `${row.daysHeld}`}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default Starter;
