import { useNavigate, useSearchParams } from 'react-router';
import { IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import paths from 'routes/paths';

const ValueReportItem = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  return (
    <Stack direction="column" spacing={3} sx={{ width: 1 }}>
      <Paper sx={{ px: { xs: 3, md: 5 }, py: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Typography variant="h4">Value Report {id ? `#${id}` : ''}</Typography>
          <Tooltip title="Back to Value Reports">
            <IconButton
              aria-label="Back"
              onClick={() => navigate(paths.valueReports)}
              sx={{
                width: 40,
                height: 40,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.elevation1',
                color: 'text.primary',
                '&:hover': { bgcolor: 'background.elevation2' },
              }}
            >
              <IconifyIcon icon="material-symbols:arrow-back-rounded" fontSize={20} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default ValueReportItem;
