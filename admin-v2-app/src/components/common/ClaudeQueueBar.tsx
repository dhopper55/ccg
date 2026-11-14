// "Queue for Claude" bar for the listing evaluator and inventory item pages (CCG Eval connector).
// Shows the item's queue status, lets the owner queue or unqueue it, and — when Claude saves an
// evaluation to this item — calls onClaudeSaved so the page reloads, with an Undo.
// Render it with key={`${kind}-${id}`} so its state starts fresh for each item.
import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  type EvalKind,
  type EvalStatus,
  formatEvaluationTime,
  queueForClaude,
  removeFromClaudeQueue,
  undoEvaluation,
  useEvalStatusPoll,
} from 'lib/evalConnector';
import IconifyIcon from 'components/base/IconifyIcon';

type Props = {
  kind: EvalKind;
  // null for an inventory item that has not been saved yet.
  id: string | null;
  // Reload the page's record (Claude's save wins over unsaved edits).
  onClaudeSaved: () => void | Promise<void>;
  showBuildListing?: boolean;
};

type Notice = { severity: 'success' | 'info' | 'error'; text: string; undoId?: string };

const ClaudeQueueBar = ({ kind, id, onClaudeSaved, showBuildListing = false }: Props) => {
  const [status, setStatus] = useState<EvalStatus | null>(null);
  const [buildListing, setBuildListing] = useState(true);
  const [deep, setDeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const baselineRef = useRef<string | undefined>(undefined);

  const { refresh } = useEvalStatusPoll({
    kind,
    id,
    onStatus: (next) => {
      setStatus(next);
      const evaluation = next.latestEvaluation;
      const key = evaluation ? `${evaluation.id}:${evaluation.status}` : 'none';
      // The first result is what was already there when the page opened.
      if (baselineRef.current === undefined) {
        baselineRef.current = key;
        return;
      }
      if (key === baselineRef.current) return;
      baselineRef.current = key;
      if (evaluation && evaluation.source === 'claude-connector' && evaluation.status === 'saved') {
        void onClaudeSaved();
        const fields = evaluation.fieldsWritten.length
          ? `: ${evaluation.fieldsWritten.join(', ')}`
          : '';
        setNotice({
          severity: 'success',
          text: `Updated by Claude ${formatEvaluationTime(evaluation.createdAt)}${fields}. Unsaved edits on this page were replaced.`,
          undoId: evaluation.id,
        });
      }
    },
  });

  const queue = status?.queue ?? null;
  const lastQueue = status?.lastQueue ?? null;
  const liveChannels = status?.liveChannels ?? [];
  const latest = status?.latestEvaluation ?? null;

  const doQueue = async () => {
    if (!id) return;
    setConfirmOpen(false);
    setBusy(true);
    setNotice(null);
    try {
      await queueForClaude(kind, id, { buildListing: showBuildListing && buildListing, deep });
      refresh();
    } catch (error) {
      setNotice({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Unable to queue for Claude.',
      });
    } finally {
      setBusy(false);
    }
  };

  const onQueueClick = () => {
    if (kind === 'inventory' && liveChannels.length) setConfirmOpen(true);
    else void doQueue();
  };

  const doRemove = async () => {
    if (!queue) return;
    setBusy(true);
    try {
      await removeFromClaudeQueue(queue.id);
      refresh();
    } catch (error) {
      setNotice({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Unable to remove from the queue.',
      });
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const doUndo = async (evaluationId: string) => {
    setBusy(true);
    try {
      await undoEvaluation(evaluationId);
      baselineRef.current = `${evaluationId}:undone`;
      await onClaudeSaved();
      setNotice({ severity: 'info', text: "Undone: Claude's changes were reverted." });
      refresh();
    } catch (error) {
      setNotice({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Unable to undo.',
      });
    } finally {
      setBusy(false);
    }
  };

  let statusChip: {
    label: string;
    color: 'default' | 'info' | 'warning' | 'success' | 'error';
  } | null = null;
  if (queue?.status === 'queued') {
    statusChip = {
      label: queue.position > 1 ? `Queued (#${queue.position})` : 'Queued (next)',
      color: 'info',
    };
  } else if (queue?.status === 'in_progress') {
    statusChip = { label: 'Claude is evaluating…', color: 'warning' };
  } else if (lastQueue?.status === 'failed') {
    statusChip = { label: 'Claude skipped it', color: 'error' };
  } else if (latest && latest.source === 'claude-connector' && latest.status === 'saved') {
    statusChip = { label: `Evaluated ${formatEvaluationTime(latest.createdAt)}`, color: 'success' };
  } else if (lastQueue?.status === 'done' && !lastQueue.evaluationId) {
    statusChip = { label: 'Marked evaluated', color: 'success' };
  }

  return (
    <Paper sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
      <Stack direction="column" gap={1.5}>
        <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <IconifyIcon icon="material-symbols:smart-toy-outline-rounded" fontSize={20} />
          <Typography variant="subtitle2">Claude</Typography>
          {statusChip ? (
            <Chip size="small" color={statusChip.color} label={statusChip.label} />
          ) : null}
          {latest &&
          latest.source === 'claude-connector' &&
          latest.status === 'saved' &&
          !notice?.undoId &&
          !queue ? (
            <Button
              size="small"
              color="inherit"
              disabled={busy}
              onClick={() => void doUndo(latest.id)}
            >
              Undo last
            </Button>
          ) : null}
        </Stack>

        {!id ? (
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="outlined" size="small" disabled>
              Queue for Claude
            </Button>
            <Typography variant="caption" color="text.secondary">
              Save the item first.
            </Typography>
          </Stack>
        ) : queue ? (
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              {queue.status === 'in_progress'
                ? 'Claude is working on this item now.'
                : `Waiting for Claude. In the Claude app, say "eval".${queue.options.build_listing ? ' Build Listing is on.' : ''}${queue.options.deep ? ' Deep.' : ''}`}
            </Typography>
            {queue.status === 'queued' ? (
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                disabled={busy}
                onClick={() => void doRemove()}
              >
                Remove from queue
              </Button>
            ) : null}
          </Stack>
        ) : (
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="small"
              disabled={busy || !status}
              onClick={onQueueClick}
              startIcon={<IconifyIcon icon="material-symbols:playlist-add-rounded" />}
            >
              Queue for Claude
            </Button>
            {showBuildListing ? (
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={buildListing}
                    onChange={(event) => setBuildListing(event.target.checked)}
                  />
                }
                label="Build Listing"
              />
            ) : null}
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={deep}
                  onChange={(event) => setDeep(event.target.checked)}
                />
              }
              label="Deep"
            />
          </Stack>
        )}

        {lastQueue?.status === 'failed' && !queue ? (
          <Alert severity="warning">
            Claude skipped this item: {lastQueue.error || 'no reason given'}.
          </Alert>
        ) : null}

        {notice ? (
          <Alert
            severity={notice.severity}
            action={
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                {notice.undoId ? (
                  <Button
                    color="inherit"
                    size="small"
                    disabled={busy}
                    onClick={() => void doUndo(notice.undoId as string)}
                  >
                    Undo
                  </Button>
                ) : null}
                <Button color="inherit" size="small" onClick={() => setNotice(null)}>
                  Dismiss
                </Button>
              </Stack>
            }
          >
            {notice.text}
          </Alert>
        ) : null}
      </Stack>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>This item is for sale</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This item is currently for sale on: {liveChannels.join(', ')}. Claude will only update
            the AI Analysis and private party value; the listing and other fields stay as they are.
            Queue it anyway?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void doQueue()}>
            Queue anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ClaudeQueueBar;
