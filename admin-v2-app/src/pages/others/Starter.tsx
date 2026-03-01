import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { CallbackDataParams } from 'echarts/types/dist/shared';
import IconifyIcon from 'components/base/IconifyIcon';
import ReactEchart from 'components/base/ReactEchart';

echarts.use([TooltipComponent, GridComponent, LineChart, BarChart, CanvasRenderer]);

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
  category: string | null;
  brand: string | null;
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
  category: string | null;
  brand: string | null;
  purchasedDate: string | null;
  daysHeld: number | null;
  purchasePrice: number;
  privatePartyValue: number;
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

type StatCardProps = {
  title: string;
  subTitle: string;
  value: string;
  deltaText?: string;
  deltaColor?: 'success' | 'warning' | 'primary' | 'neutral';
  chart: React.ReactNode;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

function formatShortDate(value: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function buildImageSrc(imageUrl?: string | null): string | undefined {
  const cleaned = imageUrl?.trim();
  if (!cleaned) return undefined;
  return cleaned;
}

function sourceLabel(source: string | null): string {
  const normalized = source?.trim().toLowerCase() || '';
  if (normalized.includes('facebook')) return 'FBM';
  if (normalized.includes('craigslist')) return 'CL';
  return source?.trim() || 'Manual';
}

const DashboardStatCard = ({
  title,
  subTitle,
  value,
  deltaText,
  deltaColor = 'neutral',
  chart,
}: StatCardProps) => (
  <Paper sx={{ p: { xs: 3, md: 4 }, flex: 1, height: 1 }}>
    <Stack sx={{ rowGap: 2, height: 1, justifyContent: 'space-between' }}>
      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
          {subTitle}
        </Typography>
      </Box>

      <Stack sx={{ gap: 2, alignItems: 'end', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ color: 'text.secondary', typography: { xs: 'h5', lg: 'h4' }, mb: 1 }}>
            {value}
          </Typography>
          {deltaText ? <Chip label={deltaText} color={deltaColor} /> : null}
        </Box>
        {chart}
      </Stack>
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

        const failed = [
          summaryResponse,
          trendResponse,
          agingResponse,
          recentSalesResponse,
          oldestResponse,
        ].find((response) => !response.ok);

        if (failed) {
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
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load CCG dashboard.');
          setDashboard(initialState);
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
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: theme.palette.text.secondary,
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: {
            color: theme.palette.divider,
          },
        },
        axisLabel: {
          color: theme.palette.text.secondary,
          formatter: (value: number) => `$${Math.round(value).toLocaleString()}`,
        },
      },
      grid: { top: 16, right: 12, bottom: 16, left: 56 },
      series: [
        {
          type: 'line',
          smooth: true,
          data: points.map((point) => point.profit),
          showSymbol: false,
          lineStyle: {
            width: 4,
            color: theme.palette.primary.main,
          },
          areaStyle: {
            color: 'rgba(87, 143, 246, 0.16)',
          },
        },
      ],
    };
  }, [dashboard.profitTrend?.points, theme.palette.divider, theme.palette.primary.main, theme.palette.text.secondary]);

  const agingOption = useMemo(() => {
    const buckets = dashboard.inventoryAging?.buckets || [];
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: CallbackDataParams[]) => {
          const bucket = buckets[params[0]?.dataIndex ?? 0];
          if (!bucket) return '';
          return [
            `<strong>${bucket.label}</strong>`,
            `Cost basis: ${formatCurrency(bucket.costBasis)}`,
            `Asking value: ${formatCurrency(bucket.currentAskingValue)}`,
            `Private party: ${formatCurrency(bucket.privatePartyValue)}`,
            `Items: ${formatNumber(bucket.itemCount)}`,
          ].join('<br/>');
        },
      },
      xAxis: {
        type: 'category',
        data: buckets.map((bucket) => bucket.label.replace(' days', '')),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: theme.palette.text.secondary,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          lineStyle: {
            color: theme.palette.divider,
          },
        },
        axisLabel: {
          color: theme.palette.text.secondary,
          formatter: (value: number) => `$${Math.round(value / 1000)}k`,
        },
      },
      grid: { top: 16, right: 12, bottom: 16, left: 48 },
      series: [
        {
          type: 'bar',
          data: buckets.map((bucket) => bucket.costBasis),
          barWidth: 28,
          itemStyle: {
            borderRadius: [10, 10, 0, 0],
            color: theme.palette.success.main,
          },
        },
      ],
    };
  }, [dashboard.inventoryAging?.buckets, theme.palette.divider, theme.palette.success.main, theme.palette.text.secondary]);

  const sparklineOption = useMemo(() => {
    const points = dashboard.profitTrend?.points || [];
    return {
      xAxis: { type: 'category', data: points.map((point) => point.label), show: false },
      yAxis: { type: 'value', show: false },
      grid: { top: 0, right: 0, bottom: 0, left: 0 },
      tooltip: { show: false },
      series: [
        {
          type: 'line',
          smooth: true,
          data: points.map((point) => point.profit),
          showSymbol: false,
          lineStyle: { width: 3, color: theme.palette.primary.main },
          areaStyle: { color: 'rgba(87, 143, 246, 0.12)' },
        },
      ],
    };
  }, [dashboard.profitTrend?.points, theme.palette.primary.main]);

  const agingSparklineOption = useMemo(() => {
    const buckets = dashboard.inventoryAging?.buckets || [];
    return {
      xAxis: { type: 'category', data: buckets.map((bucket) => bucket.label), show: false },
      yAxis: { type: 'value', show: false },
      grid: { top: 0, right: 0, bottom: 0, left: 0 },
      tooltip: { show: false },
      series: [
        {
          type: 'bar',
          data: buckets.map((bucket) => bucket.costBasis),
          barWidth: 10,
          itemStyle: { borderRadius: [8, 8, 0, 0], color: theme.palette.success.main },
        },
      ],
    };
  }, [dashboard.inventoryAging?.buckets, theme.palette.success.main]);

  const kpiCards = useMemo(() => {
    const kpis = dashboard.summary?.kpis;
    if (!kpis) return [];

    return [
      {
        title: 'Inventory Cost Basis',
        value: formatCurrency(kpis.inventoryCostBasis),
        hint: 'Cash tied up in active unsold inventory',
        icon: 'material-symbols:payments-outline-rounded',
      },
      {
        title: 'Private Party Value',
        value: formatCurrency(kpis.privatePartyValue),
        hint: 'Estimated private-party value of active inventory',
        icon: 'material-symbols:local-offer-outline-rounded',
      },
      {
        title: 'Current Asking Value',
        value: formatCurrency(kpis.currentAskingValue),
        hint: 'Current asking value of items marked for sale',
        icon: 'material-symbols:sell-outline-rounded',
      },
      {
        title: 'Realized Profit MTD',
        value: formatCurrency(kpis.realizedProfitMTD),
        hint: 'Actual gross profit from items sold this month',
        icon: 'material-symbols:trending-up-rounded',
      },
      {
        title: 'For Sale Items',
        value: formatNumber(kpis.forSaleItems),
        hint: `${formatNumber(kpis.activeItems)} active, ${formatNumber(kpis.notForSaleItems)} held back`,
        icon: 'material-symbols:storefront-outline-rounded',
      },
      {
        title: 'Avg Days To Sell',
        value: `${kpis.avgDaysToSell.toFixed(1)} days`,
        hint: `${formatPercent(kpis.allTimeSoldMarginPercent)} all-time sold margin`,
        icon: 'material-symbols:schedule-outline-rounded',
      },
    ];
  }, [dashboard.summary]);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minWidth: 0 }}>
      <Stack sx={{ gap: 3 }}>
        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        {isLoading && !dashboard.summary ? (
          <Paper sx={{ p: 5 }}>
            <Stack sx={{ alignItems: 'center', gap: 2 }}>
              <CircularProgress size={28} />
              <Typography sx={{ color: 'text.secondary' }}>Loading dashboard data...</Typography>
            </Stack>
          </Paper>
        ) : (
          <>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 5, lg: 4, xl: 3 }}>
                <Paper
                  sx={{
                    p: { xs: 3, md: 5 },
                    height: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle1" sx={{ color: 'text.secondary', fontWeight: 500, mb: 1 }}>
                      {dashboard.summary?.asOf ? formatShortDate(dashboard.summary.asOf) : 'Today'}
                    </Typography>
                    <Typography variant="h3" sx={{ mb: 2 }}>
                      CCG Home
                    </Typography>
                    <Typography sx={{ color: 'text.secondary' }}>
                      Buy low, sell high, and keep cash moving. This view focuses on tied-up money,
                      realized profit, and the inventory most likely to need attention.
                    </Typography>
                  </Box>

                  <Divider flexItem />

                  <Stack sx={{ gap: 2 }}>
                    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                      <Avatar sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}>
                        <IconifyIcon icon="material-symbols:storefront-outline-rounded" />
                      </Avatar>
                      <Box>
                        <Typography variant="h4">{formatNumber(dashboard.summary?.kpis.forSaleItems || 0)}</Typography>
                        <Typography sx={{ color: 'text.secondary', fontWeight: 700 }}>For sale items</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                      <Avatar sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}>
                        <IconifyIcon icon="material-symbols:inventory-2-outline-rounded" />
                      </Avatar>
                      <Box>
                        <Typography variant="h4">{formatNumber(dashboard.summary?.kpis.activeItems || 0)}</Typography>
                        <Typography sx={{ color: 'text.secondary', fontWeight: 700 }}>Active items</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
                      <Avatar sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}>
                        <IconifyIcon icon="material-symbols:paid-outline-rounded" />
                      </Avatar>
                      <Box>
                        <Typography variant="h4">{formatCurrency(dashboard.summary?.kpis.realizedProfitMTD || 0)}</Typography>
                        <Typography sx={{ color: 'text.secondary', fontWeight: 700 }}>Profit this month</Typography>
                      </Box>
                    </Stack>
                  </Stack>

                  <Divider flexItem />

                  <Stack sx={{ gap: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                      Immediate operating snapshot.
                    </Typography>
                    {dashboard.oldestInventory.slice(0, 3).map((item) => (
                      <Stack
                        key={item.id}
                        direction="row"
                        sx={{
                          py: 1.75,
                          px: 1.5,
                          bgcolor: 'background.elevation2',
                          borderRadius: 2,
                          gap: 1.5,
                          alignItems: 'center',
                        }}
                      >
                        <Box
                          component="img"
                          src={buildImageSrc(item.imageUrl)}
                          alt={item.title}
                          sx={{ width: 48, height: 48, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
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
                </Paper>
              </Grid>

              <Grid container size={{ xs: 12, md: 7, lg: 8, xl: 9 }}>
                <Grid size={{ xs: 12, xl: 6.6 }}>
                  <Paper sx={{ p: { xs: 3, md: 4 }, height: 1 }}>
                    <Stack sx={{ gap: 3, height: 1 }}>
                      <Box>
                        <Typography variant="h6" sx={{ mb: 1 }}>
                          Profit Trend
                        </Typography>
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                          Realized gross profit over the last 12 months
                        </Typography>
                      </Box>
                      <Typography variant="h3">
                        {formatCurrency(
                          (dashboard.profitTrend?.points || []).reduce((sum, point) => sum + point.profit, 0),
                        )}
                      </Typography>
                      <Chip label="12 months" color="success" />
                      <ReactEchart echarts={echarts} option={profitTrendOption} sx={{ minHeight: 260, width: 1 }} />
                    </Stack>
                  </Paper>
                </Grid>

                <Grid container size={{ xs: 12, xl: 5.4 }}>
                  <Grid size={{ xs: 12, sm: 6, xl: 12 }}>
                    <DashboardStatCard
                      title="Inventory Cost Basis"
                      subTitle="Cash currently tied up"
                      value={formatCurrency(dashboard.summary?.kpis.inventoryCostBasis || 0)}
                      deltaText={`${formatNumber(dashboard.summary?.kpis.activeItems || 0)} active`}
                      deltaColor="primary"
                      chart={<ReactEchart echarts={echarts} option={sparklineOption} sx={{ height: 120, width: '42%' }} />}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, xl: 12 }}>
                    <DashboardStatCard
                      title="Private Party Value"
                      subTitle="Expected private-party value"
                      value={formatCurrency(dashboard.summary?.kpis.privatePartyValue || 0)}
                      deltaText={`${formatPercent(dashboard.summary?.kpis.allTimeSoldMarginPercent || 0)} margin`}
                      deltaColor="success"
                      chart={<ReactEchart echarts={echarts} option={agingSparklineOption} sx={{ height: 120, width: '42%' }} />}
                    />
                  </Grid>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Paper sx={{ p: { xs: 3, md: 4 } }}>
                    <Stack
                      direction={{ xs: 'column', xl: 'row' }}
                      sx={{ gap: 3, alignItems: { xs: 'stretch', xl: 'center' } }}
                    >
                      <Box sx={{ minWidth: { xl: 260 } }}>
                        <Typography variant="h3" sx={{ mb: 1 }}>
                          Inventory Aging
                        </Typography>
                        <Typography sx={{ color: 'text.secondary' }}>
                          Cost basis concentration across unsold inventory age buckets.
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <ReactEchart echarts={echarts} option={agingOption} sx={{ minHeight: 260, width: 1 }} />
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, xl: 7 }}>
                <Paper sx={{ p: { xs: 3, md: 4 }, height: 1 }}>
                  <Stack sx={{ gap: 3, height: 1 }}>
                    <Box>
                      <Typography variant="h3" sx={{ mb: 1 }}>
                        Recent Sales
                      </Typography>
                      <Typography sx={{ color: 'text.secondary' }}>
                        Most recent sold items with realized spread and hold time.
                      </Typography>
                    </Box>

                    <Stack sx={{ gap: 2 }}>
                      {dashboard.recentSales.slice(0, 5).map((item) => (
                        <Stack
                          key={item.id}
                          direction="row"
                          sx={{
                            py: 2,
                            px: 2,
                            bgcolor: 'background.elevation2',
                            borderRadius: 2,
                            gap: 2,
                            alignItems: 'center',
                            minWidth: 0,
                          }}
                        >
                          <Box
                            component="img"
                            src={buildImageSrc(item.imageUrl)}
                            alt={item.title}
                            sx={{ width: 72, height: 72, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
                          />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="h6" sx={{ lineHeight: 1.25, mb: 1 }}>
                              {item.title}
                            </Typography>
                            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                              <Chip label={item.ccgNumber} size="small" variant="soft" color="primary" />
                              <Chip label={`Profit ${formatCurrency(item.profitAmount)}`} size="small" variant="soft" color={item.profitAmount >= 0 ? 'success' : 'error'} />
                              {item.daysHeld != null ? <Chip label={`${item.daysHeld} days`} size="small" variant="soft" color="neutral" /> : null}
                            </Stack>
                          </Box>
                          <Box sx={{ textAlign: 'right', minWidth: 120 }}>
                            <Typography variant="h5">{formatCurrency(item.soldAmount)}</Typography>
                            <Typography sx={{ color: 'text.secondary' }}>{formatShortDate(item.soldDate)}</Typography>
                          </Box>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, xl: 5 }}>
                <Paper sx={{ p: { xs: 3, md: 4 }, height: 1 }}>
                  <Stack sx={{ gap: 3, height: 1 }}>
                    <Box>
                      <Typography variant="h3" sx={{ mb: 1 }}>
                        Oldest Inventory
                      </Typography>
                      <Typography sx={{ color: 'text.secondary' }}>
                        The oldest unsold pieces currently holding cash and shelf space.
                      </Typography>
                    </Box>

                    <Stack sx={{ gap: 2 }}>
                      {dashboard.oldestInventory.slice(0, 5).map((item) => (
                        <Stack
                          key={item.id}
                          direction="row"
                          sx={{
                            py: 2,
                            px: 2,
                            bgcolor: 'background.elevation2',
                            borderRadius: 2,
                            gap: 2,
                            alignItems: 'center',
                            minWidth: 0,
                          }}
                        >
                          <Box
                            component="img"
                            src={buildImageSrc(item.imageUrl)}
                            alt={item.title}
                            sx={{ width: 56, height: 56, borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
                          />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="h6" sx={{ lineHeight: 1.25, mb: 1 }}>
                              {item.title}
                            </Typography>
                            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                              <Chip label={sourceLabel(item.source)} size="small" variant="soft" color="neutral" />
                              <Chip label={item.forSale ? 'For sale' : 'Held'} size="small" variant="soft" color={item.forSale ? 'success' : 'warning'} />
                            </Stack>
                          </Box>
                          <Box sx={{ textAlign: 'right', minWidth: 96 }}>
                            <Typography variant="h6">{item.daysHeld != null ? `${item.daysHeld}d` : '--'}</Typography>
                            <Typography sx={{ color: 'text.secondary' }}>{formatCurrency(item.purchasePrice)}</Typography>
                          </Box>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </>
        )}
      </Stack>
    </Box>
  );
};

export default Starter;
