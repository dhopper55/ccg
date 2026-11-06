import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, Typography } from '@mui/material';

const shopPhoneDisplay = '(303) 376-9214';
const shopPhoneE164 = '+13033769214';
const shopEmail = 'info@coalcreekguitars.com';

interface VacationModeDialogProps {
  open: boolean;
  onClose: () => void;
}

const VacationModeDialog = ({ open, onClose }: VacationModeDialogProps) => {
  // tel:/sms: links often do nothing useful on a desktop, so these are phone/tablet only.
  const phoneOnlySx = { display: { xs: 'inline-flex', md: 'none' } };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Our shipping department is temporarily closed</DialogTitle>
      <DialogContent>
        <Typography>
          We&apos;ll be back soon! To make arrangements in the meantime, call or text us at{' '}
          <strong style={{ whiteSpace: 'nowrap' }}>{shopPhoneDisplay}</strong> or email{' '}
          <Link href={`mailto:${shopEmail}`} sx={{ overflowWrap: 'anywhere' }}>
            {shopEmail}
          </Link>
          .
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button href={`tel:${shopPhoneE164}`} variant="contained" sx={phoneOnlySx}>
          Call
        </Button>
        <Button href={`sms:${shopPhoneE164}`} variant="contained" sx={phoneOnlySx}>
          Text
        </Button>
        <Button onClick={onClose} variant="soft" color="neutral">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VacationModeDialog;
