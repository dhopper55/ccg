import { Container, Paper } from '@mui/material';
import ContentMain from 'components/sections/content/homepage/ContentMain';

const Content = () => {
  return (
    <Paper
      sx={{
        minHeight: '100vh',
        borderRadius: 0,
        bgcolor: 'background.default',
        p: { xs: 2, md: 5 },
      }}
    >
      <Container maxWidth="lg" disableGutters>
        <ContentMain />
      </Container>
    </Paper>
  );
};

export default Content;
