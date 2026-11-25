import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';

// CCG Agent: the always-on local tool (home PC / MacBook) that runs jobs queued here.
// Instances each have a key; only one is Active (allowed to take jobs) at a time.
// Endpoints: workers/listing-evaluator/src/agent/handlers.ts

type Instance = {
  id: string;
  label: string;
  keyHint: string;
  active: boolean;
  createdAt: number;
  lastSeenAt: number | null;
  hostname: string | null;
  platform: string | null;
  version: string | null;
  managed: boolean;
  status: string | null;
  statusDetail: string | null;
  currentJobId: string | null;
  modules: string[];
};

type Job = {
  id: string;
  module: string;
  type: string;
  payload: unknown;
  status: 'queued' | 'claimed' | 'done' | 'failed' | 'cancelled';
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  claimedByLabel: string | null;
  claimedAt: number | null;
  finishedAt: number | null;
  result: unknown;
  error: string | null;
};

type LogLine = {
  id: number;
  instanceId: string;
  jobId: string | null;
  ts: number;
  level: string;
  message: string;
};

type Overview = {
  instances: Instance[];
  settings: { desiredRef: string };
  jobCounts: Record<string, number>;
  eval?: { last24h: number; maxPerDay: number };
  heartbeatSeconds: number;
  serverTime: number;
  message?: string;
};

const POLL_MS = 10_000;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: string;
  };
  if (!response.ok)
    throw new Error(data.message || data.error || `Request failed (${response.status}).`);
  return data;
}

const post = <T,>(url: string, body?: unknown) =>
  api<T>(url, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

function ago(ms: number | null, now: number): string {
  if (!ms) return 'never';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function when(ms: number | null): string {
  return ms ? new Date(ms).toLocaleString() : '-';
}

function duration(job: Job): string {
  if (!job.claimedAt) return '-';
  const end = job.finishedAt ?? Date.now();
  const s = Math.round((end - job.claimedAt) / 1000);
  return s < 120 ? `${s}s` : `${Math.round(s / 60)}m`;
}

function jobScreenshots(job: Job): string[] {
  const shots = (job.result as { screenshots?: unknown } | null)?.screenshots;
  return Array.isArray(shots) ? shots.filter((key): key is string => typeof key === 'string') : [];
}

function isOnline(instance: Instance, overview: Overview): boolean {
  if (!instance.lastSeenAt || instance.status === 'stopped') return false;
  return overview.serverTime - instance.lastSeenAt < overview.heartbeatSeconds * 3 * 1000;
}

const JOB_STATUS_COLOR: Record<
  Job['status'],
  'default' | 'info' | 'warning' | 'success' | 'error'
> = {
  queued: 'info',
  claimed: 'warning',
  done: 'success',
  failed: 'error',
  cancelled: 'default',
};

export default function CcgAgent() {
  const { enqueueSnackbar } = useSnackbar();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [jobFilter, setJobFilter] = useState('');
  const [scoutIgnoreLimits, setScoutIgnoreLimits] = useState(false);
  const [logInstance, setLogInstance] = useState('');
  const [desiredRef, setDesiredRef] = useState('');
  const [refDirty, setRefDirty] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState<{ label: string; key: string } | null>(null);
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [detailLogs, setDetailLogs] = useState<LogLine[]>([]);

  const load = useCallback(async () => {
    try {
      const jobParams = new URLSearchParams({ limit: '50' });
      if (jobFilter) jobParams.set('status', jobFilter);
      const logParams = new URLSearchParams({ limit: '200' });
      if (logInstance) logParams.set('instanceId', logInstance);
      const [o, j, l] = await Promise.all([
        api<Overview>('/api/admin-v2/agent'),
        api<{ jobs: Job[] }>(`/api/admin-v2/agent/jobs?${jobParams}`),
        api<{ logs: LogLine[] }>(`/api/admin-v2/agent/logs?${logParams}`),
      ]);
      setOverview(o);
      setJobs(j.jobs);
      setLogs(l.logs);
      setError('');
      if (!refDirty) setDesiredRef(o.settings.desiredRef);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load CCG Agent data.');
    }
  }, [jobFilter, logInstance, refDirty]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await action();
      if (success) enqueueSnackbar(success, { variant: 'success' });
      await load();
    } catch (actionError) {
      enqueueSnackbar(actionError instanceof Error ? actionError.message : 'Action failed.', {
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const instanceLabels = useMemo(
    () => new Map((overview?.instances ?? []).map((i) => [i.id, i.label])),
    [overview],
  );

  const openJob = async (job: Job) => {
    setDetailJob(job);
    setDetailLogs([]);
    try {
      const data = await api<{ logs: LogLine[] }>(
        `/api/admin-v2/agent/logs?jobId=${job.id}&limit=500`,
      );
      setDetailLogs(data.logs.slice().reverse());
    } catch {
      // logs are optional in the dialog
    }
  };

  const createInstance = () =>
    run(async () => {
      const data = await post<{ instance: Instance; key: string }>(
        '/api/admin-v2/agent/instances',
        { label: newLabel },
      );
      setAddOpen(false);
      setNewLabel('');
      setNewKey({ label: data.instance.label, key: data.key });
    });

  const now = overview?.serverTime ?? Date.now();
  const activeInstance = overview?.instances.find((i) => i.active);

  return (
    <Stack direction="column" spacing={3} sx={{ width: 1, pb: 4 }}>
      {/* ---------------- Instances ---------------- */}
      <Paper sx={{ p: { xs: 3, md: 4 }, width: 1, display: 'block' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          spacing={2}
          mb={2}
        >
          <Box>
            <Typography variant="h4">CCG Agent</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {activeInstance
                ? `Active instance: ${activeInstance.label}${isOnline(activeInstance, overview!) ? '' : ' (offline)'}`
                : 'No active instance — queued jobs will wait.'}
            </Typography>
          </Box>
          <Button variant="contained" disabled={busy} onClick={() => setAddOpen(true)}>
            Add instance
          </Button>
        </Stack>

        {activeInstance &&
        overview &&
        isOnline(activeInstance, overview) &&
        activeInstance.status === 'fb_login_needed' ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Facebook needs a login on {activeInstance.label} (
            {activeInstance.hostname ?? 'this machine'}). Facebook jobs are waiting in the queue. On
            that machine: stop the agent, run <code>.venv/bin/python -m ccg_agent fb-login</code>{' '}
            (Windows: <code>.venv\Scripts\python -m ccg_agent fb-login</code>), log in, then start
            the agent again.
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Instance</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Machine</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Version</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overview && overview.instances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    No instances yet. Add one, then put its key on the machine.
                  </TableCell>
                </TableRow>
              ) : null}
              {(overview?.instances ?? []).map((instance) => {
                const online = isOnline(instance, overview!);
                return (
                  <TableRow key={instance.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {instance.label}
                        </Typography>
                        {instance.active ? (
                          <Chip size="small" color="success" label="ACTIVE" />
                        ) : null}
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        key …{instance.keyHint}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          size="small"
                          variant="soft"
                          color={
                            !online
                              ? 'default'
                              : instance.status === 'fb_login_needed' ||
                                  instance.status === 'claude_login_needed'
                                ? 'error'
                                : instance.status === 'working'
                                  ? 'warning'
                                  : instance.status === 'idle'
                                    ? 'success'
                                    : 'info'
                          }
                          label={online ? (instance.status ?? 'online') : 'offline'}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          seen {ago(instance.lastSeenAt, now)}
                        </Typography>
                      </Stack>
                      {online && instance.statusDetail ? (
                        <Typography
                          variant="caption"
                          component="div"
                          sx={{ color: 'text.secondary' }}
                        >
                          {instance.statusDetail}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{instance.hostname ?? '-'}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {instance.platform ?? ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {instance.version ?? '-'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {instance.lastSeenAt
                          ? instance.managed
                            ? 'auto-update'
                            : 'dev run (no auto-update)'
                          : ''}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {instance.active ? (
                        <Button
                          size="small"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => post(`/api/admin-v2/agent/instances/${instance.id}/deactivate`),
                              `${instance.label} deactivated.`,
                            )
                          }
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => post(`/api/admin-v2/agent/instances/${instance.id}/activate`),
                              `${instance.label} is now the active instance.`,
                            )
                          }
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        size="small"
                        disabled={busy}
                        onClick={() => {
                          const label = window.prompt('Rename instance', instance.label);
                          if (label && label.trim() && label.trim() !== instance.label) {
                            void run(() =>
                              post(`/api/admin-v2/agent/instances/${instance.id}/rename`, {
                                label: label.trim(),
                              }),
                            );
                          }
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${instance.label}"? Its key stops working immediately.`,
                            )
                          ) {
                            void run(
                              () => post(`/api/admin-v2/agent/instances/${instance.id}/delete`),
                              'Instance deleted.',
                            );
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ maxWidth: 560 }}>
            <TextField
              size="small"
              label="Agent version (git branch, tag or full commit)"
              value={desiredRef}
              onChange={(event) => {
                setDesiredRef(event.target.value);
                setRefDirty(true);
              }}
              sx={{ flex: 1 }}
            />
            <Button
              variant="outlined"
              disabled={busy || !refDirty || !desiredRef.trim()}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={() =>
                void run(async () => {
                  await post('/api/admin-v2/agent/settings', { desiredRef: desiredRef.trim() });
                  setRefDirty(false);
                }, 'Agent version saved. Auto-update instances switch within ~5 minutes.')
              }
            >
              Save version
            </Button>
          </Stack>
          <Typography variant="caption" component="div" sx={{ color: 'text.secondary', mt: 1 }}>
            Instances started by the launcher pull this from GitHub when idle. Dev runs ignore it.
          </Typography>
        </Box>
      </Paper>

      {/* ---------------- Jobs ---------------- */}
      <Paper sx={{ p: { xs: 3, md: 4 }, width: 1, display: 'block' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          spacing={2}
          mb={2}
        >
          <Box>
            <Typography variant="h5">Jobs</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {Object.entries(overview?.jobCounts ?? {})
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ') || 'No jobs yet.'}
            </Typography>
            {overview?.eval ? (
              <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                Agent evals in the last 24 hours: {overview.eval.last24h} of{' '}
                {overview.eval.maxPerDay}
                {overview.eval.last24h >= overview.eval.maxPerDay
                  ? ' — daily limit reached, evals are waiting'
                  : ''}
              </Typography>
            ) : null}
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <TextField
              select
              size="small"
              label="Status"
              value={jobFilter}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              onChange={(e) => setJobFilter(e.target.value)}
              sx={{ minWidth: 130 }}
            >
              <MenuItem value="">All</MenuItem>
              {['queued', 'claimed', 'done', 'failed', 'cancelled'].map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              disabled={busy}
              onClick={() =>
                void run(
                  () => post('/api/admin-v2/agent/scout/run', { ignoreLimits: scoutIgnoreLimits }),
                  scoutIgnoreLimits ? 'Scout scan queued (limits ignored).' : 'Scout scan queued.',
                )
              }
            >
              Run scout now
            </Button>
            <FormControlLabel
              sx={{ mr: 1 }}
              control={
                <Checkbox
                  size="small"
                  checked={scoutIgnoreLimits}
                  onChange={(event) => setScoutIgnoreLimits(event.target.checked)}
                />
              }
              label="Ignore limits"
            />
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    post('/api/admin-v2/agent/jobs', {
                      module: 'system',
                      type: 'ping',
                      payload: { from: 'admin' },
                    }),
                  'Ping queued.',
                )
              }
            >
              Send test ping
            </Button>
            <Button
              variant="outlined"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    post('/api/admin-v2/agent/jobs', {
                      module: 'system',
                      type: 'sleep',
                      payload: { seconds: 120 },
                    }),
                  '2-minute test job queued.',
                )
              }
            >
              Send 2-min job
            </Button>
          </Stack>
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Job</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Instance</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Took</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Error</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>No jobs.</TableCell>
                </TableRow>
              ) : null}
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => void openJob(job)}
                >
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {ago(job.createdAt, Date.now())}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace' }}>
                    {job.module}.{job.type}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="soft"
                      color={JOB_STATUS_COLOR[job.status]}
                      label={job.status === 'claimed' ? 'running' : job.status}
                    />
                    {job.maxAttempts > 1 ? (
                      <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                        {job.attempts}/{job.maxAttempts}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{job.claimedByLabel ?? '-'}</TableCell>
                  <TableCell>{duration(job)}</TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 320,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'error.main',
                    }}
                  >
                    {job.error ?? ''}
                  </TableCell>
                  <TableCell
                    sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {job.status === 'queued' || job.status === 'claimed' ? (
                      <Button
                        size="small"
                        color="error"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => post(`/api/admin-v2/agent/jobs/${job.id}/cancel`),
                            'Job cancelled.',
                          )
                        }
                      >
                        Cancel
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => post(`/api/admin-v2/agent/jobs/${job.id}/retry`),
                            'Job re-queued.',
                          )
                        }
                      >
                        Retry
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ---------------- Logs ---------------- */}
      <Paper sx={{ p: { xs: 3, md: 4 }, width: 1, display: 'block' }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
          mb={2}
        >
          <Typography variant="h5">Logs</Typography>
          <TextField
            select
            size="small"
            label="Instance"
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            value={logInstance}
            onChange={(e) => setLogInstance(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All instances</MenuItem>
            {(overview?.instances ?? []).map((i) => (
              <MenuItem key={i.id} value={i.id}>
                {i.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Box
          sx={{
            fontFamily: 'monospace',
            fontSize: 12,
            maxHeight: 420,
            overflow: 'auto',
            bgcolor: 'background.elevation1',
            borderRadius: 1,
            p: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {logs.length === 0 ? 'No log lines yet.' : null}
          {logs.map((line) => (
            <Box
              key={line.id}
              sx={{
                color:
                  line.level === 'ERROR'
                    ? 'error.main'
                    : line.level === 'WARNING'
                      ? 'warning.main'
                      : 'text.primary',
              }}
            >
              {new Date(line.ts).toLocaleString()} {line.level.padEnd(7)} [
              {instanceLabels.get(line.instanceId) ?? line.instanceId.slice(0, 8)}]
              {line.jobId ? ` (job ${line.jobId.slice(0, 8)})` : ''} {line.message}
            </Box>
          ))}
        </Box>
      </Paper>

      {/* ---------------- Dialogs ---------------- */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add instance</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Label (e.g. Home PC, MacBook)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newLabel.trim()) void createInstance();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy || !newLabel.trim()}
            onClick={() => void createInstance()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!newKey} onClose={() => setNewKey(null)} fullWidth maxWidth="sm">
        <DialogTitle>Key for {newKey?.label}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Copy this now — it's only shown once. If you lose it, delete the instance and add a new
            one.
          </Alert>
          <TextField
            fullWidth
            size="small"
            value={newKey?.key ?? ''}
            slotProps={{ input: { readOnly: true, sx: { fontFamily: 'monospace' } } }}
          />
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            Mac: put <code>CCG_AGENT_KEY=…</code> in <code>ccg-agent/.env</code>. Windows: pass it
            to <code>install-windows.ps1 -Key …</code>. New instances start inactive — click
            Activate to give one jobs.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (newKey)
                void navigator.clipboard
                  .writeText(newKey.key)
                  .then(() => enqueueSnackbar('Key copied.', { variant: 'success' }));
            }}
          >
            Copy
          </Button>
          <Button variant="contained" onClick={() => setNewKey(null)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!detailJob} onClose={() => setDetailJob(null)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontFamily: 'monospace' }}>
          {detailJob?.module}.{detailJob?.type} — {detailJob?.status}
        </DialogTitle>
        <DialogContent>
          {detailJob ? (
            <Stack direction="column" spacing={2}>
              <Typography variant="body2">
                Created {when(detailJob.createdAt)} · started {when(detailJob.claimedAt)} · finished{' '}
                {when(detailJob.finishedAt)}
                {detailJob.claimedByLabel ? ` · on ${detailJob.claimedByLabel}` : ''}
              </Typography>
              {detailJob.error ? (
                <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>
                  {detailJob.error}
                </Alert>
              ) : null}
              {jobScreenshots(detailJob).map((key) => (
                <Box
                  key={key}
                  component="a"
                  href={`/api/admin-v2/agent/screenshot?key=${encodeURIComponent(key)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Box
                    component="img"
                    src={`/api/admin-v2/agent/screenshot?key=${encodeURIComponent(key)}`}
                    alt="Screenshot from the agent"
                    sx={{ width: 1, borderRadius: 1, border: 1, borderColor: 'divider' }}
                  />
                </Box>
              ))}
              {[
                ['Payload', detailJob.payload],
                ['Result', detailJob.result],
              ].map(([title, value]) => (
                <Box key={title as string}>
                  <Typography variant="subtitle2">{title as string}</Typography>
                  <Box
                    component="pre"
                    sx={{
                      fontSize: 12,
                      m: 0,
                      p: 1,
                      bgcolor: 'background.elevation1',
                      borderRadius: 1,
                      overflow: 'auto',
                    }}
                  >
                    {value == null ? '—' : JSON.stringify(value, null, 2)}
                  </Box>
                </Box>
              ))}
              <Box>
                <Typography variant="subtitle2">Logs</Typography>
                <Box
                  component="pre"
                  sx={{
                    fontSize: 12,
                    m: 0,
                    p: 1,
                    bgcolor: 'background.elevation1',
                    borderRadius: 1,
                    overflow: 'auto',
                    maxHeight: 300,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {detailLogs.length === 0
                    ? '—'
                    : detailLogs
                        .map(
                          (l) => `${new Date(l.ts).toLocaleTimeString()} ${l.level} ${l.message}`,
                        )
                        .join('\n')}
                </Box>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailJob(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
