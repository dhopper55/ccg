import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { useSearchParams } from 'react-router';

type SerialPatternTextRecord = {
  id: number;
  brand: string;
  pattern: string;
  regexPattern: string;
  richText: string;
  richTextPopulated: boolean;
};

type SerialPatternTextResponse = {
  records: SerialPatternTextRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  message?: string;
};

type SortBy = 'brand' | 'pattern' | 'populated';

type EditState = {
  brand: string;
  pattern: string;
  regexPattern: string;
  richText: string;
  mode: 'add' | 'update';
};

const PAGE_SIZE = 20;
const AI_REGEX_PROMPT_TEMPLATE = 'Tell me what you know about <BRAND> guitars with a serial number that matches this regex: <REGEX>';

function formatBrandName(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '-';
  return normalized.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
}

const SerialPatternText = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<SerialPatternTextRecord[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('brand');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [saveErrorMessage, setSaveErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editState, setEditState] = useState<EditState | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const setEditorRef = (node: HTMLDivElement | null) => {
    editorRef.current = node;
    if (node && editState) {
      node.innerHTML = editState.richText || '';
    }
  };

  useEffect(() => {
    document.title = 'CCG Admin | Serial Pattern Text';
  }, []);

  useEffect(() => {
    const lookupId = searchParams.get('id')?.trim() || '';
    const shouldOpen = searchParams.get('open') === '1';
    if (!shouldOpen || !lookupId) return;

    let cancelled = false;

    const openTargetRow = async () => {
      setSaveMessage('');
      setSaveErrorMessage('');
      setErrorMessage('');

      try {
        const params = new URLSearchParams();
        params.set('id', lookupId);
        params.set('showAll', '1');
        params.set('limit', '1');
        params.set('_', String(Date.now()));

        const response = await fetch(`/api/admin-v2/serial-pattern-text?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const data = (await response.json()) as SerialPatternTextResponse;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load serial pattern text row.');
        }
        if (cancelled) return;

        const targetRow = Array.isArray(data.records) ? data.records[0] : null;
        if (!targetRow) {
          throw new Error('Associated serial pattern row was not found.');
        }

        setEditState({
          brand: targetRow.brand,
          pattern: targetRow.pattern,
          regexPattern: targetRow.regexPattern || '',
          richText: targetRow.richText || '',
          mode: (targetRow.richText || '').trim() ? 'update' : 'add',
        });
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load serial pattern text row.');
      } finally {
        if (!cancelled) {
          setSearchParams({}, { replace: true });
        }
      }
    };

    void openTargetRow();

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (!editState) {
      editorRef.current.innerHTML = '';
      return;
    }
    editorRef.current.innerHTML = editState.richText || '';
  }, [editState]);

  useEffect(() => {
    let cancelled = false;

    const loadRows = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(PAGE_SIZE));
        params.set('sortBy', sortBy);
        params.set('sortDir', sortDir);
        if (showAll) params.set('showAll', '1');
        params.set('_', String(Date.now()));

        const response = await fetch(`/api/admin-v2/serial-pattern-text?${params.toString()}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const data = (await response.json()) as SerialPatternTextResponse;
        if (!response.ok) {
          throw new Error(data.message || 'Unable to load serial pattern text rows.');
        }
        if (cancelled) return;

        setRecords(Array.isArray(data.records) ? data.records : []);
        setPage(Math.max(1, Number(data.page) || 1));
        setTotal(Math.max(0, Number(data.total) || 0));
        setTotalPages(Math.max(1, Number(data.totalPages) || 1));
      } catch (error) {
        if (cancelled) return;
        setRecords([]);
        setTotal(0);
        setTotalPages(1);
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load serial pattern text rows.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadRows();

    return () => {
      cancelled = true;
    };
  }, [page, showAll, sortBy, sortDir, refreshKey]);

  const pageStart = useMemo(() => (total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0), [page, total]);
  const pageEnd = useMemo(() => {
    if (total < 1) return 0;
    return Math.min(total, page * PAGE_SIZE);
  }, [page, total]);

  const toggleSort = (field: SortBy) => {
    setPage(1);
    if (sortBy === field) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortDir('asc');
  };

  const handleSave = async () => {
    if (!editState) return;
    setSaving(true);
    setSaveErrorMessage('');

    try {
      const response = await fetch('/api/admin-v2/serial-pattern-text', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand: editState.brand,
          pattern: editState.pattern,
          richText: editState.richText,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'Unable to save rich text.');
      }

      setEditState(null);
      setSaveMessage('Pattern text saved.');
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setSaveErrorMessage(error instanceof Error ? error.message : 'Unable to save rich text.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3} sx={{ width: 1, pb: 4 }}>
      <Paper sx={{ p: { xs: 3, md: 4 }, width: 1, display: 'block' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
          mb={2}
        >
          <Typography variant="h4">Serial Pattern Text</Typography>

          <FormControlLabel
            sx={{ mr: 0 }}
            control={(
              <Checkbox
                size="small"
                checked={showAll}
                onChange={(event) => {
                  setPage(1);
                  setShowAll(event.target.checked);
                }}
              />
            )}
            label="Show All"
          />
        </Stack>

        {saveMessage ? <Alert severity="success" sx={{ mb: 2 }}>{saveMessage}</Alert> : null}
        {errorMessage ? <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert> : null}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === 'brand'}
                    direction={sortBy === 'brand' ? sortDir : 'asc'}
                    onClick={() => toggleSort('brand')}
                  >
                    Brand
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === 'pattern'}
                    direction={sortBy === 'pattern' ? sortDir : 'asc'}
                    onClick={() => toggleSort('pattern')}
                  >
                    Pattern
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortBy === 'populated'}
                    direction={sortBy === 'populated' ? sortDir : 'asc'}
                    onClick={() => toggleSort('populated')}
                  >
                    Rich Text Populated
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Action</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary" py={2}>
                      Loading...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : records.length < 1 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary" py={2}>
                      No rows found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((row) => (
                  <TableRow key={`${row.brand}:${row.pattern}`} hover>
                    <TableCell>{formatBrandName(row.brand)}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{row.pattern}</TableCell>
                    <TableCell>{row.richTextPopulated ? 'Yes' : 'No'}</TableCell>
                    <TableCell sx={{ textAlign: 'right' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          setSaveMessage('');
                          setSaveErrorMessage('');
                          setEditState({
                            brand: row.brand,
                            pattern: row.pattern,
                            regexPattern: row.regexPattern || '',
                            richText: row.richText || '',
                            mode: (row.richText || '').trim() ? 'update' : 'add',
                          });
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
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

      <Dialog open={Boolean(editState)} onClose={() => (saving ? undefined : setEditState(null))} fullWidth maxWidth="md">
        <DialogTitle>Edit Serial Pattern Text</DialogTitle>
        <DialogContent dividers sx={{ display: 'block' }}>
          {editState ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                rowGap: 2,
                width: 1,
              }}
            >
              {saveErrorMessage ? <Alert severity="error">{saveErrorMessage}</Alert> : null}

              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Chip
                  size="small"
                  color={editState.mode === 'add' ? 'warning' : 'info'}
                  variant="outlined"
                  label={editState.mode === 'add' ? 'Mode: Add (AI paraphrase on save)' : 'Mode: Update (direct save)'}
                />
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                  columnGap: 2,
                  rowGap: 1.5,
                  width: 1,
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Brand</Typography>
                  <Typography variant="body2">{formatBrandName(editState.brand)}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Pattern</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{editState.pattern}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Regex Pattern</Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>
                      {editState.regexPattern || '-'}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const prompt = AI_REGEX_PROMPT_TEMPLATE
                          .replace('<BRAND>', formatBrandName(editState.brand))
                          .replace('<REGEX>', editState.regexPattern || editState.pattern || '-');
                        const url = `https://www.google.com/search?q=${encodeURIComponent(prompt)}`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      AI Regex Search
                    </Button>
                  </Stack>
                </Box>
              </Box>

              <Box sx={{ width: 1 }}>
                <Typography variant="caption" color="text.secondary">Enter rich text content</Typography>
                <Box
                  ref={setEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(event) => {
                    const html = (event.currentTarget as HTMLDivElement).innerHTML;
                    setEditState((current) => (current ? { ...current, richText: html } : current));
                  }}
                  sx={{
                    mt: 0.75,
                    minHeight: 280,
                    maxHeight: 460,
                    overflowY: 'auto',
                    width: 1,
                    borderRadius: 1.5,
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.default',
                    color: 'text.primary',
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                    '&:focus': {
                      outline: 'none',
                      borderColor: 'primary.main',
                    },
                    '& p, & ul, & ol, & blockquote, & h3, & h4': {
                      mt: 0,
                      mb: 1,
                    },
                    '&[contenteditable=\"true\"]:empty:before': {
                      content: '\"Paste formatted content here\"',
                      color: 'text.disabled',
                    },
                  }}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 1, width: 1 }}>
                <Button variant="outlined" disabled={saving} onClick={() => setEditState(null)} sx={{ width: 1 }}>
                  Cancel
                </Button>
                <Button variant="contained" disabled={saving} onClick={() => void handleSave()} sx={{ width: 1 }}>
                  Save
                </Button>
              </Box>
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default SerialPatternText;
