import { Button, Paper, Stack } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import SectionHeader from 'components/common/SectionHeader';
import StyledTextField from 'components/styled/StyledTextField';

const ActiveUsers = () => {
  return (
    <Paper
      sx={{
        height: 1,
        overflow: 'hidden',
        p: { xs: 3, md: 5 },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <SectionHeader title="Number to decode" sx={{ mb: { xs: 2, md: 4 } }} />

      <Stack sx={{ gap: 2.5, maxWidth: 420 }}>
        <StyledTextField fullWidth placeholder="Enter serial number" autoFocus />
        <Button
          variant="soft"
          color="warning"
          startIcon={<IconifyIcon icon="material-symbols:psychology-alt-rounded" />}
          onClick={() => {}}
          sx={{ alignSelf: 'flex-start', fontWeight: 700 }}
        >
          Decode
        </Button>
      </Stack>
    </Paper>
  );
};

export default ActiveUsers;
