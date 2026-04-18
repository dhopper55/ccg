import { List, ListItem, ListItemIcon, ListItemText, Paper, SxProps, Typography } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

export interface ProductHighlight {
  text: string;
  danger?: boolean;
  highlight?: boolean;
}

interface HighlightsProps {
  sx?: SxProps;
  highlights: ProductHighlight[];
}

const getHighlightColor = (item: ProductHighlight) => {
  if (item.danger) return 'error.main';
  if (item.highlight) return 'info.main';
  return 'text.secondary';
};

const Highlights = ({ sx, highlights }: HighlightsProps) => {
  const visibleHighlights = highlights.slice(0, 6);

  return (
    <Paper sx={{ p: { xs: 3, md: 5 }, ...sx }}>
      <Typography
        variant="h6"
        sx={{
          mb: 3,
        }}
      >
        Highlights
      </Typography>
      {visibleHighlights.length > 0 ? (
        <List disablePadding>
          {visibleHighlights.map((item) => (
            <ListItem
              key={item.text}
              disableGutters
              sx={{
                alignItems: 'flex-start',
                gap: 1.5,
                py: 0.75,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  color: getHighlightColor(item),
                  pt: 0.25,
                }}
              >
                <IconifyIcon icon="material-symbols:check-circle-outline-rounded" fontSize={20} />
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  variant: 'body2',
                  color: getHighlightColor(item),
                }}
                sx={{ m: 0 }}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Details coming soon.
        </Typography>
      )}
    </Paper>
  );
};

export default Highlights;
