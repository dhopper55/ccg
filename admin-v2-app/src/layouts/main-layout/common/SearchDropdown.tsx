import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Avatar,
  Box,
  CircularProgress,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  Typography,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import StyledTextField from 'components/styled/StyledTextField';
import paths from 'routes/paths';

type SearchResultType = 'inventory' | 'listing';

interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
}

const DEBOUNCE_MS = 450;
const MIN_CHARS = 3;

const SearchDropdown = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const runSearch = async (q: string) => {
    if (q.length < MIN_CHARS) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin-v2/search?q=${encodeURIComponent(q)}`, {
        credentials: 'same-origin',
      });
      const data = (await res.json()) as { results?: SearchResult[] };
      const fetched = Array.isArray(data.results) ? data.results : [];
      setResults(fetched);
      setOpen(fetched.length > 0 || q.length >= MIN_CHARS);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < MIN_CHARS) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(val);
    }, DEBOUNCE_MS);
  };

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    if (result.type === 'inventory') {
      navigate(paths.inventoryItemWithId(result.id));
    } else {
      navigate(paths.listingEvaluatorItemWithId(result.id));
    }
  };

  const handleBlur = () => {
    // Small delay so clicks on results register first
    setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <Box ref={anchorRef} sx={{ maxWidth: { xs: 220, md: 420 }, width: '100%' }}>
      <StyledTextField
        fullWidth
        value={query}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder="Search"
        aria-label="Search"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                {loading ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <IconifyIcon icon="material-symbols:search-rounded" fontSize={20} />
                )}
              </InputAdornment>
            ),
          },
        }}
      />

      <Popper
        open={open}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        style={{ zIndex: 1300, width: anchorRef.current?.offsetWidth }}
      >
        <Paper
          elevation={8}
          sx={{
            mt: 0.5,
            maxHeight: 420,
            overflowY: 'auto',
            borderRadius: 2,
          }}
        >
          {results.length === 0 && !loading ? (
            <Typography variant="body2" sx={{ px: 2, py: 2, color: 'text.secondary' }}>
              No results found.
            </Typography>
          ) : (
            <List dense disablePadding>
              {results.map((result) => (
                <ListItemButton
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  sx={{ gap: 1, py: 1, px: 1.5, alignItems: 'center' }}
                >
                  <IconifyIcon
                    icon={
                      result.type === 'inventory'
                        ? 'material-symbols:sell'
                        : 'material-symbols:library-add-check-outline-rounded'
                    }
                    fontSize={16}
                    sx={{ color: 'text.secondary', flexShrink: 0 }}
                  />

                  <ListItemAvatar sx={{ minWidth: 44, ml: 0.5 }}>
                    <Avatar
                      variant="rounded"
                      src={result.imageUrl || undefined}
                      alt={result.title}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1.5,
                        bgcolor: 'background.elevation1',
                      }}
                    >
                      <IconifyIcon
                        icon={
                          result.type === 'inventory'
                            ? 'material-symbols:sell'
                            : 'material-symbols:library-add-check-outline-rounded'
                        }
                        fontSize={18}
                      />
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText
                    primary={result.title}
                    secondary={result.subtitle || undefined}
                    primaryTypographyProps={{
                      fontSize: 14,
                      fontWeight: 500,
                      noWrap: true,
                    }}
                    secondaryTypographyProps={{
                      fontSize: 12,
                      noWrap: true,
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Paper>
      </Popper>
    </Box>
  );
};

export default SearchDropdown;
