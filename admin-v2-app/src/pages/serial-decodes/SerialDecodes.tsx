import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router';
import IconifyIcon from 'components/base/IconifyIcon';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import ReactEchart from 'components/base/ReactEchart';
import paths from 'routes/paths';

echarts.use([TooltipComponent, GridComponent, BarChart, LineChart, CanvasRenderer]);

type SerialDecodeRecord = {
  id: number;
  eventTimeUtc: string | null;
  clientTimestamp: string | null;
  brand: string;
  serial: string;
  email: string | null;
  patternLookupId: number | null;
  success: boolean;
  evaluated: boolean;
  year: string | null;
  factory: string | null;
  country: string | null;
  error: string | null;
  hasGAiAnalysis: boolean;
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

type LookupVolumeView = 'day' | 'month';

type LookupVolumeRecord = {
  key: string;
  label: string;
  responseCount: number;
  successCount?: number;
  failureCount?: number;
};

type LookupVolumeResponse = {
  view: LookupVolumeView;
  records: LookupVolumeRecord[];
  availableBrands: string[];
  message?: string;
};

type DailyVolumeResponse = {
  date?: string;
  buckets?: number[];
  message?: string;
};

const PAGE_SIZE = 50;

// 48 half-hour bucket labels, each label = end time of the block
// Block 0: 12:00am–12:30am → "12:30am", Block 47: 11:30pm–midnight → "Midnight"
const DAILY_VOLUME_TIME_LABELS: string[] = (() => {
  const labels: string[] = [];
  for (let i = 0; i < 48; i++) {
    const endMinutes = ((i + 1) * 30) % (24 * 60);
    if (endMinutes === 0) {
      labels.push('Midnight');
      continue;
    }
    const hour24 = Math.floor(endMinutes / 60);
    const minute = endMinutes % 60;
    if (hour24 === 12 && minute === 0) {
      labels.push('Noon');
      continue;
    }
    const period = hour24 < 12 ? 'am' : 'pm';
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    if (minute === 0) {
      labels.push(`${hour12}${period}`);
    } else {
      labels.push(`${hour12}:${String(minute).padStart(2, '0')}${period}`);
    }
  }
  return labels;
})();

function shiftDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayMtn(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const day = parts.find((p) => p.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
}

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
  const navigate = useNavigate();
  const todayMtn = useMemo(getTodayMtn, []);

  const [records, setRecords] = useState<SerialDecodeRecord[]>([]);
  const [brandResponses, setBrandResponses] = useState<BrandResponsesRecord[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(true);
  const [onlyUnevaluated, setOnlyUnevaluated] = useState(true);
  const [timestampSortDir, setTimestampSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [chartErrorMessage, setChartErrorMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<SerialDecodeRecord | null>(null);
  const [updatingEvaluatedIds, setUpdatingEvaluatedIds] = useState<number[]>([]);
  const [evaluatedPendingRecordId, setEvaluatedPendingRecordId] = useState<number | null>(null);
  const [deletingRecordIds, setDeletingRecordIds] = useState<number[]>([]);
  const [deleteTargetRecord, setDeleteTargetRecord] = useState<SerialDecodeRecord | null>(null);
  const [lookupVolumeView, setLookupVolumeView] = useState<LookupVolumeView>('day');
  const [lookupVolumeBrand, setLookupVolumeBrand] = useState('');
  const [lookupVolumeRecords, setLookupVolumeRecords] = useState<LookupVolumeRecord[]>([]);
  const [lookupVolumeAvailableBrands, setLookupVolumeAvailableBrands] = useState<string[]>([]);
  const [lookupVolumeLoading, setLookupVolumeLoading] = useState(true);
  const [lookupVolumeErrorMessage, setLookupVolumeErrorMessage] = useState('');
  const [avg30DailyLookups, setAvg30DailyLookups] = useState<number | null>(null);
  const [aiAnalysisText, setAiAnalysisText] = useState('');
  const [aiAnalysisDialogError, setAiAnalysisDialogError] = useState('');
  const [processingAI, setProcessingAI] = useState(false);
  const [developerNeededMessage, setDeveloperNeededMessage] = useState('');
  const [devHandoffOpen, setDevHandoffOpen] = useState(false);
  const [devHandoffText, setDevHandoffText] = useState('');
  const [devHandoffLoading, setDevHandoffLoading] = useState(false);
  const [dailyVolumeDate, setDailyVolumeDate] = useState(getTodayMtn);
  const [dailyVolumeBuckets, setDailyVolumeBuckets] = useState<number[]>(new Array(48).fill(0));
  const [dailyVolumeLoading, setDailyVolumeLoading] = useState(true);
  const [dailyVolumeErrorMessage, setDailyVolumeErrorMessage] = useState('');

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
        params.set('_', String(Date.now()));
        const response = await fetch(`/api/admin-v2/serial-decodes/brand-responses?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
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
        if (onlyErrors && onlyUnevaluated) params.set('unevaluated', '1');
        params.set('_', String(Date.now()));

        const response = await fetch(`/api/admin-v2/serial-decodes?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
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
  }, [onlyErrors, onlyUnevaluated, page, refreshKey, selectedBrand, timestampSortDir]);

  useEffect(() => {
    let cancelled = false;

    const loadLookupVolume = async () => {
      setLookupVolumeLoading(true);
      setLookupVolumeErrorMessage('');
      try {
        const params = new URLSearchParams();
        params.set('view', lookupVolumeView);
        if (lookupVolumeBrand) params.set('brand', lookupVolumeBrand);
        params.set('_', String(Date.now()));
        const response = await fetch(`/api/admin-v2/serial-decodes/lookup-volume?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const data = (await response.json()) as LookupVolumeResponse;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load serial lookup volume chart.');
        }
        if (cancelled) return;
        const records = Array.isArray(data.records) ? data.records : [];
        setLookupVolumeRecords(records);
        setLookupVolumeAvailableBrands(Array.isArray(data.availableBrands) ? data.availableBrands : []);
        if (data.view === 'day' && !lookupVolumeBrand) {
          const total = records.reduce((s, r) => s + Number(r.responseCount || 0), 0);
          setAvg30DailyLookups(Math.round(total / 30));
        }
      } catch (error) {
        if (cancelled) return;
        setLookupVolumeRecords([]);
        setLookupVolumeAvailableBrands([]);
        setLookupVolumeErrorMessage(
          error instanceof Error ? error.message : 'Unable to load serial lookup volume chart.',
        );
      } finally {
        if (!cancelled) setLookupVolumeLoading(false);
      }
    };

    void loadLookupVolume();

    return () => {
      cancelled = true;
    };
  }, [lookupVolumeBrand, lookupVolumeView]);

  useEffect(() => {
    let cancelled = false;

    const loadDailyVolume = async () => {
      setDailyVolumeLoading(true);
      setDailyVolumeErrorMessage('');
      try {
        const params = new URLSearchParams();
        params.set('date', dailyVolumeDate);
        params.set('_', String(Date.now()));
        const response = await fetch(`/api/admin-v2/serial-decodes/daily-volume?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const data = (await response.json()) as DailyVolumeResponse;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load daily decode volume.');
        }
        if (cancelled) return;
        setDailyVolumeBuckets(Array.isArray(data.buckets) ? data.buckets : new Array(48).fill(0));
      } catch (error) {
        if (cancelled) return;
        setDailyVolumeBuckets(new Array(48).fill(0));
        setDailyVolumeErrorMessage(
          error instanceof Error ? error.message : 'Unable to load daily decode volume.',
        );
      } finally {
        if (!cancelled) setDailyVolumeLoading(false);
      }
    };

    void loadDailyVolume();

    return () => {
      cancelled = true;
    };
  }, [dailyVolumeDate]);

  const pageStart = useMemo(() => (page - 1) * PAGE_SIZE + 1, [page]);
  const pageEnd = useMemo(() => Math.min(page * PAGE_SIZE, total), [page, total]);
  const chartRows = useMemo(
    () => brandResponses.filter((item) => item.responseCount > 0),
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

  const lookupTotalResponses = useMemo(
    () => lookupVolumeRecords.reduce((sum, item) => sum + Number(item.responseCount || 0), 0),
    [lookupVolumeRecords],
  );
  const lookupVolumeOption = useMemo(() => ({
    grid: { left: 56, right: 20, top: 10, bottom: 10, containLabel: false },
    xAxis: {
      type: 'category',
      data: lookupVolumeRecords.map((item) => item.label),
      axisLabel: {
        rotate: 90,
        interval: 0,
        margin: 4,
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.7)',
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
      formatter: (params: Array<{ axisValueLabel?: string; value?: number; seriesIndex?: number }>) => {
        const label = params?.[0]?.axisValueLabel || '';
        const successVal = Number(params?.find((p) => p.seriesIndex === 0)?.value || 0);
        const failureVal = Number(params?.find((p) => p.seriesIndex === 1)?.value || 0);
        const total = successVal + failureVal;
        return `${label}<br/>Lookups: ${total}<br/>Success: ${successVal}<br/>Failures: ${failureVal}`;
      },
    },
    series: [
      {
        name: 'Success',
        type: 'bar',
        stack: 'total',
        data: lookupVolumeRecords.map((item) => item.successCount ?? item.responseCount),
        barWidth: '55%',
        itemStyle: {
          color: '#7e57c2',
          borderRadius: [0, 0, 0, 0],
        },
      },
      {
        name: 'Failures',
        type: 'bar',
        stack: 'total',
        data: lookupVolumeRecords.map((item) => item.failureCount ?? 0),
        barWidth: '55%',
        itemStyle: {
          color: '#ef5350',
          borderRadius: [4, 4, 0, 0],
        },
      },
    ],
  }), [lookupVolumeRecords]);

  const dailyVolumeDateFormatted = useMemo(() => {
    if (!dailyVolumeDate) return '';
    const [year, month, day] = dailyVolumeDate.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(year, month - 1, day, 12));
  }, [dailyVolumeDate]);

  const dailyVolumeTotal = useMemo(
    () => dailyVolumeBuckets.reduce((sum, n) => sum + n, 0),
    [dailyVolumeBuckets],
  );

  const dailyVolumeOption = useMemo(() => ({
    grid: { left: 8, right: 16, top: 10, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: DAILY_VOLUME_TIME_LABELS,
      boundaryGap: false,
      axisLabel: {
        rotate: 45,
        interval: 3,
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.7)',
      },
      axisLine: {
        lineStyle: { color: 'rgba(255, 255, 255, 0.25)' },
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      splitNumber: 1,
      axisLabel: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 11 },
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
        return `${label}<br/>Decodes: ${value}`;
      },
    },
    series: [
      {
        type: 'line',
        data: dailyVolumeBuckets,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#4361ee', width: 2.5 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(67, 97, 238, 0.45)' },
              { offset: 1, color: 'rgba(67, 97, 238, 0.02)' },
            ],
          },
        },
      },
    ],
  }), [dailyVolumeBuckets]);

  const handleDevHandoff = async () => {
    setDevHandoffLoading(true);
    try {
      const response = await fetch('/api/admin-v2/serial-decodes/dev-handoff');
      const data = (await response.json()) as { text?: string; count?: number; message?: string };
      if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
      setDevHandoffText(data.text || '');
      setDevHandoffOpen(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate dev handoff.');
    } finally {
      setDevHandoffLoading(false);
    }
  };

  const closeValidityDialog = () => {
    setEvaluatedPendingRecordId(null);
    setAiAnalysisText('');
    setAiAnalysisDialogError('');
    setProcessingAI(false);
  };

  const handleEvaluatedToggle = async (recordId: number, nextValue: boolean) => {
    if (nextValue) {
      setEvaluatedPendingRecordId(recordId);
      setAiAnalysisText('N/A');
      return;
    }
    setUpdatingEvaluatedIds((current) => [...current, recordId]);
    try {
      const response = await fetch(`/api/admin-v2/serial-decodes/${recordId}/evaluated`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluated: false }),
      });
      const data = (await response.json()) as { evaluated?: boolean; updatedCount?: number; message?: string };
      if (!response.ok) {
        throw new Error(data.message || `Unable to update evaluated state (HTTP ${response.status}).`);
      }
      setRecords((current) => current.map((row) => (
        row.id === recordId ? { ...row, evaluated: Boolean(data.evaluated) } : row
      )));
      setSelectedRecord((current) => (
        current && current.id === recordId ? { ...current, evaluated: Boolean(data.evaluated) } : current
      ));
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update evaluated state.');
    } finally {
      setUpdatingEvaluatedIds((current) => current.filter((id) => id !== recordId));
    }
  };

  const handleValidityNo = async () => {
    const recordId = evaluatedPendingRecordId;
    closeValidityDialog();
    if (recordId === null) return;
    setUpdatingEvaluatedIds((current) => [...current, recordId]);
    try {
      const response = await fetch(`/api/admin-v2/serial-decodes/${recordId}/evaluated`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluated: true, isValid: false }),
      });
      const data = (await response.json()) as { evaluated?: boolean; updatedCount?: number; message?: string };
      if (!response.ok) {
        throw new Error(data.message || `Unable to update evaluated state (HTTP ${response.status}).`);
      }
      setRecords((current) => current.map((row) => (
        row.id === recordId ? { ...row, evaluated: Boolean(data.evaluated) } : row
      )));
      setSelectedRecord((current) => (
        current && current.id === recordId ? { ...current, evaluated: Boolean(data.evaluated) } : current
      ));
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update evaluated state.');
    } finally {
      setUpdatingEvaluatedIds((current) => current.filter((id) => id !== recordId));
    }
  };

  const handleValidityYes = async () => {
    const recordId = evaluatedPendingRecordId;
    if (recordId === null) return;
    setAiAnalysisDialogError('');
    setProcessingAI(true);
    setUpdatingEvaluatedIds((current) => [...current, recordId]);
    try {
      const response = await fetch(`/api/admin-v2/serial-decodes/${recordId}/evaluated`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluated: true, isValid: true, aiAnalysisText: aiAnalysisText.trim() }),
      });
      const data = (await response.json()) as {
        evaluated?: boolean;
        updatedCount?: number;
        needsDeveloper?: boolean;
        decodeFailed?: boolean;
        message?: string;
      };
      if (data.needsDeveloper) {
        closeValidityDialog();
        setDeveloperNeededMessage('This serial pattern requires a developer to implement. Serial not marked as evaluated.');
        return;
      }
      if (data.decodeFailed) {
        setAiAnalysisDialogError(data.message || 'This serial still did not decode. Paste AI analysis text to continue.');
        setProcessingAI(false);
        return;
      }
      if (!response.ok) {
        throw new Error(data.message || `Unable to update evaluated state (HTTP ${response.status}).`);
      }
      closeValidityDialog();
      setRecords((current) => current.map((row) => (
        row.id === recordId ? { ...row, evaluated: Boolean(data.evaluated) } : row
      )));
      setSelectedRecord((current) => (
        current && current.id === recordId ? { ...current, evaluated: Boolean(data.evaluated) } : current
      ));
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setAiAnalysisDialogError(error instanceof Error ? error.message : 'Unable to process serial.');
      setProcessingAI(false);
    } finally {
      setUpdatingEvaluatedIds((current) => current.filter((id) => id !== recordId));
    }
  };

  const handleDeleteRecord = async () => {
    const target = deleteTargetRecord;
    if (!target) return;

    setDeletingRecordIds((current) => [...current, target.id]);
    try {
      const response = await fetch(`/api/admin-v2/serial-decodes/${target.id}/delete`, {
        method: 'POST',
        credentials: 'same-origin',
      });

      const data = (await response.json()) as { deletedCount?: number; message?: string };
      if (!response.ok) {
        throw new Error(data.message || `Unable to delete serial decode record (HTTP ${response.status}).`);
      }

      setRecords((current) => current.filter((row) => row.id !== target.id));
      setSelectedRecord((current) => (current && current.id === target.id ? null : current));
      setDeleteTargetRecord(null);
      setTotal((current) => Math.max(0, current - 1));

      if (records.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        setRefreshKey((current) => current + 1);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete serial decode record.');
    } finally {
      setDeletingRecordIds((current) => current.filter((id) => id !== target.id));
    }
  };

  return (
    <Stack direction="column" spacing={3} sx={{ width: 1 }}>
      {/* 1. Serial Decodes grid */}
      <Paper sx={{ p: { xs: 3, md: 4 }, width: 1, display: 'block' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
          mb={3}
        >
          <Box>
            <Typography variant="h4">Serial Decodes</Typography>
            {avg30DailyLookups !== null ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Avg. Daily Lookups (last 30): {avg30DailyLookups}
              </Typography>
            ) : null}
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
            <Button
              variant="outlined"
              size="small"
              disabled={devHandoffLoading}
              onClick={() => void handleDevHandoff()}
              startIcon={devHandoffLoading ? <CircularProgress size={14} /> : undefined}
            >
              Dev Handoff
            </Button>
            <FormControlLabel
              sx={{ mr: 0 }}
              control={
                <Checkbox
                  size="small"
                  checked={onlyErrors}
                  onChange={(event) => {
                    setPage(1);
                    const next = event.target.checked;
                    setOnlyErrors(next);
                    if (next) {
                      setOnlyUnevaluated(false);
                    } else {
                      setOnlyUnevaluated(false);
                    }
                  }}
                />
              }
              label="Only errors"
            />
            {onlyErrors ? (
              <FormControlLabel
                sx={{ mr: 0 }}
                control={
                  <Checkbox
                    size="small"
                    checked={onlyUnevaluated}
                    onChange={(event) => {
                      setPage(1);
                      setOnlyUnevaluated(event.target.checked);
                    }}
                  />
                }
                label="Unevaluated"
              />
            ) : null}
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
                <TableCell sx={{ fontWeight: 700 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Stack direction="row" justifyContent="center" py={4}>
                      <CircularProgress size={26} />
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : records.length < 1 ? (
                <TableRow>
                  <TableCell colSpan={6}>
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
                      <TableCell sx={{ color: `${successColor} !important` }}>
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          {record.success && record.patternLookupId ? (
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                const params = new URLSearchParams({
                                  id: String(record.patternLookupId),
                                  open: '1',
                                });
                                navigate(`${paths.serialPatternText}?${params.toString()}`);
                              }}
                            >
                              Pattern
                            </Button>
                          ) : null}
                          {record.hasGAiAnalysis ? (
                            <Tooltip title="AI analysis stored for this record">
                              <IconButton
                                size="small"
                                aria-label="AI analysis stored"
                                onClick={(event) => event.stopPropagation()}
                                sx={{
                                  color: '#ff9800',
                                  border: '1px solid',
                                  borderColor: 'rgba(255, 152, 0, 0.4)',
                                  width: 30,
                                  height: 30,
                                  '&:hover': {
                                    backgroundColor: 'rgba(255, 152, 0, 0.08)',
                                    borderColor: '#ff9800',
                                  },
                                }}
                              >
                                <Typography sx={{ fontSize: '10px', fontWeight: 700, lineHeight: 1, color: '#ff9800' }}>
                                  AI
                                </Typography>
                              </IconButton>
                            </Tooltip>
                          ) : null}
                          <Tooltip title="Search Google for this serial number">
                            <IconButton
                              size="small"
                              aria-label="Search Google for this serial number"
                              onClick={(event) => {
                                event.stopPropagation();
                                const query = `Is "${record.serial}" a real, confirmed, documented valid serial number for a ${formatBrandName(record.brand)} guitar? Answer about this exact serial number, not just whether a string like it could plausibly fit the general format. Only answer yes if you can cite a specific documented source (not a forum guess or "some collectors believe") confirming this exact serial number, your explanation accounts for every character in the serial with none left over or reinterpreted, there is exactly one plausible reading rather than multiple conflicting options, and no field is outside its normal range (such as an invalid month) explained away as a "special case" without independent documentation. Also check whether this could instead be a typo or misread of a different known valid format. Start your answer with either CONFIRMED VALID or NOT CONFIRMED, then explain why.`;
                                window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank', 'noopener,noreferrer');
                              }}
                              sx={{
                                color: '#4cc9f0',
                                border: '1px solid',
                                borderColor: 'rgba(76, 201, 240, 0.35)',
                                '&:hover': {
                                  backgroundColor: 'rgba(76, 201, 240, 0.08)',
                                  borderColor: '#4cc9f0',
                                },
                              }}
                            >
                              <IconifyIcon icon="mdi:file-multiple-outline" fontSize={18} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete decode record">
                            <span>
                              <IconButton
                                size="small"
                                aria-label="Delete decode record"
                                disabled={deletingRecordIds.includes(record.id)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDeleteTargetRecord(record);
                                }}
                                sx={{
                                  color: 'error.main',
                                  border: '1px solid',
                                  borderColor: 'rgba(244, 67, 54, 0.35)',
                                  '&:hover': {
                                    backgroundColor: 'rgba(244, 67, 54, 0.08)',
                                    borderColor: 'error.main',
                                  },
                                }}
                              >
                                <IconifyIcon icon="mdi:trash-can-outline" fontSize={18} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
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

      {/* 2. Serial Lookups Over Time */}
      <Paper sx={{ p: { xs: 3, md: 4 }, width: 1, display: 'block' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
          mb={2.5}
        >
          <Box>
            <Typography variant="h5">Serial Lookups Over Time</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {lookupTotalResponses} lookups across {lookupVolumeRecords.length} {lookupVolumeView === 'day' ? 'days' : 'months'}
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="serial-lookup-view-filter-label">View</InputLabel>
              <Select
                labelId="serial-lookup-view-filter-label"
                value={lookupVolumeView}
                label="View"
                onChange={(event) => setLookupVolumeView(String(event.target.value || 'day') as LookupVolumeView)}
              >
                <MenuItem value="day">Day (last 30)</MenuItem>
                <MenuItem value="month">Month (last 30)</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="serial-lookup-brand-filter-label">Brand</InputLabel>
              <Select
                labelId="serial-lookup-brand-filter-label"
                value={lookupVolumeBrand}
                label="Brand"
                onChange={(event) => setLookupVolumeBrand(String(event.target.value || ''))}
              >
                <MenuItem value="">All brands</MenuItem>
                {lookupVolumeAvailableBrands.map((brand) => (
                  <MenuItem key={brand} value={brand}>
                    {formatBrandName(brand)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>

        {lookupVolumeErrorMessage ? <Alert severity="error" sx={{ mb: 2 }}>{lookupVolumeErrorMessage}</Alert> : null}

        {lookupVolumeLoading ? (
          <Stack direction="row" justifyContent="center" py={4}>
            <CircularProgress size={26} />
          </Stack>
        ) : lookupVolumeRecords.length > 0 ? (
          <ReactEchart
            echarts={echarts}
            option={lookupVolumeOption}
            sx={{ height: 280, width: '100%', minWidth: 0 }}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">No serial lookup volume data available.</Typography>
        )}
      </Paper>

      {/* 3. Decodes by Time of Day */}
      <Paper sx={{ p: { xs: 3, md: 4 }, width: 1, display: 'block' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
          mb={2.5}
        >
          <Stack spacing={0.5}>
            <Typography variant="h5">Decodes by Time of Day</Typography>
            <Typography variant="body2" color="text.secondary">
              {dailyVolumeLoading ? 'Loading…' : `${dailyVolumeTotal} decode${dailyVolumeTotal !== 1 ? 's' : ''} on ${dailyVolumeDateFormatted} · Mountain Time`}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <TextField
              type="date"
              size="small"
              value={dailyVolumeDate}
              inputProps={{ max: todayMtn }}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                setDailyVolumeDate(val);
              }}
              sx={{ width: 160 }}
            />
            <IconButton
              size="small"
              aria-label="Next day"
              disabled={dailyVolumeDate >= todayMtn}
              onClick={() => setDailyVolumeDate((d) => shiftDateStr(d, 1))}
            >
              <IconifyIcon icon="mdi:chevron-left" fontSize={20} />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Previous day"
              onClick={() => setDailyVolumeDate((d) => shiftDateStr(d, -1))}
            >
              <IconifyIcon icon="mdi:chevron-right" fontSize={20} />
            </IconButton>
          </Stack>
        </Stack>

        {dailyVolumeErrorMessage ? <Alert severity="error" sx={{ mb: 2 }}>{dailyVolumeErrorMessage}</Alert> : null}

        {dailyVolumeLoading ? (
          <Stack direction="row" justifyContent="center" py={4}>
            <CircularProgress size={26} />
          </Stack>
        ) : (
          <ReactEchart
            echarts={echarts}
            option={dailyVolumeOption}
            sx={{ height: 260, width: '100%', minWidth: 0 }}
          />
        )}
      </Paper>

      {/* 4. Brand Responses */}
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
              {selectedRecord.email ? (
                <Box>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body2">{selectedRecord.email}</Typography>
                </Box>
              ) : null}

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

      <Dialog
        open={Boolean(deleteTargetRecord)}
        onClose={() => {
          if (deleteTargetRecord && deletingRecordIds.includes(deleteTargetRecord.id)) return;
          setDeleteTargetRecord(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete Decode Record</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            Are you sure you want to delete this decode record?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            variant="outlined"
            onClick={() => setDeleteTargetRecord(null)}
            disabled={Boolean(deleteTargetRecord && deletingRecordIds.includes(deleteTargetRecord.id))}
          >
            No
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleDeleteRecord()}
            disabled={Boolean(deleteTargetRecord && deletingRecordIds.includes(deleteTargetRecord.id))}
          >
            Yes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={devHandoffOpen} onClose={() => setDevHandoffOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <span>Dev Handoff</span>
            <Tooltip title="Copy to clipboard">
              <IconButton
                size="small"
                onClick={() => { void navigator.clipboard.writeText(devHandoffText); }}
                sx={{ color: '#4cc9f0' }}
              >
                <IconifyIcon icon="mdi:content-copy" fontSize={18} />
              </IconButton>
            </Tooltip>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {devHandoffText ? (
            <TextField
              multiline
              fullWidth
              value={devHandoffText}
              inputProps={{ readOnly: true, style: { fontFamily: 'monospace', fontSize: 13 } }}
              minRows={12}
              maxRows={28}
              variant="outlined"
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              No unevaluated error records with AI analysis found.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="contained" onClick={() => setDevHandoffOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(developerNeededMessage)}
        onClose={() => setDeveloperNeededMessage('')}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Developer Required</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">{developerNeededMessage}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="contained" onClick={() => setDeveloperNeededMessage('')}>
            Ok
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={evaluatedPendingRecordId !== null}
        onClose={closeValidityDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Is this serial number valid?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Paste the Google AI analysis below, then click <strong>Yes</strong> to have the system attempt to add this pattern automatically.
          </Typography>
          <TextField
            multiline
            minRows={6}
            maxRows={14}
            fullWidth
            placeholder="Paste AI analysis here..."
            value={aiAnalysisText}
            onChange={(e) => {
              setAiAnalysisText(e.target.value);
              if (aiAnalysisDialogError) setAiAnalysisDialogError('');
            }}
            disabled={processingAI}
            sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
          />
          {aiAnalysisDialogError ? (
            <Alert severity="error" sx={{ mt: 1.5 }}>{aiAnalysisDialogError}</Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" disabled={processingAI} onClick={closeValidityDialog}>
            Cancel
          </Button>
          <Button variant="outlined" color="error" disabled={processingAI} onClick={() => void handleValidityNo()}>
            No
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={processingAI}
            onClick={() => void handleValidityYes()}
            startIcon={processingAI ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {processingAI ? 'Processing…' : 'Yes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default SerialDecodes;
